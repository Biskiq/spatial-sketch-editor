/**
 * F.3 — channel negotiation, reading and cleanup (AM-3).
 *
 * Negotiation is where the common contract decides contention:
 *
 * - an unadmitted **required** family is rejected; an unadmitted **optional**
 *   family is reported unavailable and may be ignored;
 * - a contribution whose descriptor does not match the family's declaration is
 *   refused, so a contributor cannot redefine a family's meaning, and a family's
 *   owning domain must agree with the address's owner domain;
 * - an address must be one the family admits (its owner subject kind, frame kind
 *   and address qualification), and its owner reference — and an owner-qualified
 *   frame — must **resolve against the supplied snapshot's current content**, so a
 *   stale exact reference or an unresolved project-lock reference never enters as
 *   though it were current;
 * - the contention boundary is the **semantic property scope**
 *   (`ChannelPropertyScope`): the canonical owner the reference resolved to, the
 *   address's own qualification, its frame, its property and its scope instance.
 *   Distinct valid references to one subject therefore contend for one property,
 *   while distinct subjects, frames and scope instances never merge;
 * - competing exclusive contributions are rejected with the domain, address,
 *   the conflicting owners (their invocation identities) and an actionable
 *   reason, while the same invocation's deliberate replacement by a newer run is
 *   accepted;
 * - an `ordered-replacement` property accepts only a strictly newer accepted run
 *   epoch than any run that scope has accepted, so an older run cannot reclaim it;
 * - a `union` property holds **one contribution per invocation**, each ordered by
 *   its own run epoch; its value is the union read across current contributors, so
 *   one owner replaces or withdraws its own contribution without touching another's;
 * - a `camera-output` property is admitted only from the run holding the Camera
 *   output, so the ticket protocol stays the one Camera ownership authority;
 * - a contribution that can no longer prove it belongs to the context — the
 *   supplied snapshot's **content**, the active generation, or the live Camera
 *   output claim — is stale. One rule (`channelContributionStaleness`) decides it
 *   everywhere: an incoming stale contribution is refused, stale entries in the
 *   negotiated scope expire, reads never return them and `pruneChannelState`
 *   drops them. Content, not the acceptance token: an accepted revision is fresh
 *   on every source change *including Undo/Redo*, so a contribution computed from
 *   content the snapshot still holds is current. The other declared inputs
 *   (`parameters`, `frame`, `intent`, `clock`, `viewport-rect`, `source-extent`,
 *   `source-kind-filter`, `reveal-set`, `epoch`) are the owning evaluator's duty to
 *   re-evaluate, since `computedFrom` is the only provenance a contribution carries.
 *
 * Run-epoch ordering outlives a contribution: a withdrawn or replaced run is
 * retired, so a stale completion can neither delete a newer contribution
 * (`withdrawChannelContribution` is epoch-qualified) nor re-enter afterwards.
 *
 * This is arbitration of **values**, not evaluation of them: no pose, frame,
 * matrix or geometry is computed here, and no setter is exposed. Every function is
 * pure and returns a new state.
 */

import type { ShapeIssue } from '../strict-shape';
import { resolveFrame, resolveReference } from '../references/resolve';
import type { FrameReference, ReferenceDomain, ReferenceLocation } from '../references/types';
import { declaredProperty, type ChannelHost } from './families';
import { validateChannelAddress, validateChannelContribution } from './validate';
import {
	type ChannelAddress,
	type ChannelContribution,
	type ChannelContributionHandle,
	type ChannelDiagnostic,
	type ChannelEntry,
	type ChannelEpochMark,
	type ChannelEvaluationContext,
	type ChannelFamily,
	type ChannelNegotiationOutcome,
	type ChannelOwnerIdentity,
	type ChannelPropertyRead,
	type ChannelPropertyScope,
	type ChannelRejectionReason,
	type ChannelSourceIdentity,
	type ChannelState,
	type ChannelValue,
	type ChannelWithdrawal
} from './types';

/** An empty accepted-contribution state. */
export const EMPTY_CHANNEL_STATE: ChannelState = { entries: [], marks: [] };

// ---------------------------------------------------------------------------
// Structural identity — every comparison is field by field; nothing is encoded.

function samePath(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function sameLocation(left: ReferenceLocation, right: ReferenceLocation): boolean {
	if (left.kind === 'project-root' || right.kind === 'project-root') return left.kind === right.kind;
	return left.levelId === right.levelId && samePath(left.structureInstancePath, right.structureInstancePath);
}

function sameFrame(left: FrameReference, right: FrameReference): boolean {
	if (left.kind === 'project-world' || right.kind === 'project-world') return left.kind === right.kind;
	return left.owner === right.owner && left.frameId === right.frameId && left.revision === right.revision;
}

function sameOwner(left: ChannelOwnerIdentity, right: ChannelOwnerIdentity): boolean {
	return (
		left.domain === right.domain &&
		left.subject.kind === right.subject.kind &&
		left.subject.id === right.subject.id &&
		samePath(left.instancePath, right.instancePath) &&
		sameLocation(left.location, right.location) &&
		left.componentId === right.componentId &&
		left.capabilityId === right.capabilityId
	);
}

/** Two scopes of one family and scope instance that may differ only in their property. */
function sameScopeInstance(left: ChannelPropertyScope, right: ChannelPropertyScope): boolean {
	return (
		left.family === right.family &&
		left.scopeId === right.scopeId &&
		sameOwner(left.owner, right.owner) &&
		samePath(left.instancePath, right.instancePath) &&
		left.componentId === right.componentId &&
		left.capabilityId === right.capabilityId &&
		sameFrame(left.frame, right.frame)
	);
}

/** Structural property-scope equality: the one contention boundary of F.3. */
export function sameChannelPropertyScope(left: ChannelPropertyScope, right: ChannelPropertyScope): boolean {
	return left.propertyId === right.propertyId && sameScopeInstance(left, right);
}

/** Structural source-identity equality: distinct opaque id paths always differ. */
export function sameChannelSourceIdentity(left: ChannelSourceIdentity, right: ChannelSourceIdentity): boolean {
	return (
		left.domain === right.domain &&
		left.subject.kind === right.subject.kind &&
		left.subject.id === right.subject.id &&
		samePath(left.instancePath, right.instancePath)
	);
}

function compareIds(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function comparePaths(left: readonly string[], right: readonly string[]): number {
	for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
		const order = compareIds(left[index]!, right[index]!);
		if (order !== 0) return order;
	}
	return left.length - right.length;
}

/** Stable ID order over source identities, so a union read is deterministic. */
function compareSourceIdentities(left: ChannelSourceIdentity, right: ChannelSourceIdentity): number {
	return (
		compareIds(left.domain, right.domain) ||
		compareIds(left.subject.kind, right.subject.kind) ||
		compareIds(left.subject.id, right.subject.id) ||
		comparePaths(left.instancePath, right.instancePath)
	);
}

/** Membership equality for a declared identifier set; validation rejects duplicates. */
function sameMembers(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) return false;
	const members = new Set(left);
	return right.every((identifier) => members.has(identifier));
}

function sameIdentities(left: readonly ChannelSourceIdentity[], right: readonly ChannelSourceIdentity[]): boolean {
	if (left.length !== right.length) return false;
	return left.every((identity) => right.some((candidate) => sameChannelSourceIdentity(candidate, identity)));
}

/**
 * Value equality within one declared property scope. The descriptor and scope are
 * already proved equal, so the two values always share a kind; each kind is
 * compared by the identity *it* declares. A set kind is its membership, never the
 * order its members were listed in.
 */
function sameValue(left: ChannelValue, right: ChannelValue): boolean {
	if (left.kind === 'number' && right.kind === 'number') return left.value === right.value;
	if (left.kind === 'vector3' && right.kind === 'vector3') {
		return left.value.every((component, index) => component === right.value[index]);
	}
	if (left.kind === 'identifier' && right.kind === 'identifier') return left.value === right.value;
	if (left.kind === 'identifier-set' && right.kind === 'identifier-set') return sameMembers(left.value, right.value);
	if (left.kind === 'source-set' && right.kind === 'source-set') return sameIdentities(left.value, right.value);
	return false;
}

/**
 * The union of several contributors' set values, members in stable ID order. All
 * values belong to one declared property, so they share its set kind.
 */
function unionValues(values: readonly ChannelValue[]): ChannelValue {
	if (values[0]?.kind === 'identifier-set') {
		const members = new Set<string>();
		for (const value of values) if (value.kind === 'identifier-set') for (const member of value.value) members.add(member);
		return { kind: 'identifier-set', value: [...members].sort(compareIds) };
	}
	const members: ChannelSourceIdentity[] = [];
	for (const value of values) {
		if (value.kind !== 'source-set') continue;
		for (const identity of value.value) {
			if (!members.some((existing) => sameChannelSourceIdentity(existing, identity))) members.push(identity);
		}
	}
	return { kind: 'source-set', value: members.sort(compareSourceIdentities) };
}

// ---------------------------------------------------------------------------
// Qualification — what an address means in the supplied context.

export type ChannelScopeResolution =
	| { kind: 'resolved'; scope: ChannelPropertyScope }
	| { kind: 'refused'; reason: ChannelRejectionReason; message: string; action: string };

/**
 * Resolve an address into its semantic property scope under one family and
 * context. The address must be one the family admits, its owner reference must
 * resolve against the supplied snapshot **at that snapshot's current content**, and
 * an owner-qualified frame must resolve through its owner. The scope's owner is the
 * resolved canonical subject — so `exact` and `project-lock` revisions, or a
 * `project-root` and a level-qualified location of one entity, are one scope —
 * while the F.1 references themselves stay distinct values.
 */
export function resolveChannelPropertyScope(
	family: ChannelFamily,
	address: ChannelAddress,
	scopeId: string,
	context: ChannelEvaluationContext
): ChannelScopeResolution {
	const owner = address.ownerReference;
	const admission = family.admission;
	if (!admission.ownerSubjectKinds.includes(owner.subject.kind)) {
		return {
			kind: 'refused',
			reason: 'inadmissible-address',
			message: `family "${family.id}" is owned by ${admission.ownerSubjectKinds.map((kind) => `"${kind}"`).join(' or ')} subjects, not "${owner.subject.kind}"`,
			action: 'Address the property to a subject the family is owned by.'
		};
	}
	if (!admission.qualifiedAddresses && (address.instancePath.length > 0 || address.componentId !== null || address.capabilityId !== null)) {
		return {
			kind: 'refused',
			reason: 'inadmissible-address',
			message: `family "${family.id}" declares no instance, component or capability qualification below its owner`,
			action: 'Address the property to its owner with an empty instance path and no component or capability.'
		};
	}
	if (!admission.frameKinds.includes(address.frame.kind)) {
		return {
			kind: 'refused',
			reason: 'inadmissible-address',
			message: `family "${family.id}" admits ${admission.frameKinds.join(' or ')} frames, not "${address.frame.kind}"`,
			action: 'Express the value in a frame the family admits.'
		};
	}
	const resolution = resolveReference(owner, context.read);
	const current = context.read.snapshot.sourceContentId;
	if (resolution.kind !== 'resolved') {
		return {
			kind: 'refused',
			reason: 'unresolved-owner-reference',
			message: `the owner reference does not resolve in the supplied snapshot (${resolution.code}): ${resolution.message}`,
			action: resolution.repairs[0]?.description ?? 'Re-resolve the owner from the current snapshot.'
		};
	}
	if (resolution.subject.contentRevision !== current) {
		return {
			kind: 'refused',
			reason: 'unresolved-owner-reference',
			message: `the owner reference resolves at content "${resolution.subject.contentRevision}" and the supplied snapshot is content "${current}"`,
			action: 'Re-resolve the owner from the current snapshot before contributing.'
		};
	}
	if (address.frame.kind === 'owner-frame') {
		const frame = resolveFrame(address.frame, context.read);
		if (frame.kind !== 'resolved') {
			return {
				kind: 'refused',
				reason: 'unresolved-frame',
				message: `the ${address.frame.owner} frame "${address.frame.frameId}" does not resolve (${frame.code}): ${frame.message}`,
				action: frame.repairs[0]?.description ?? 'Express the value in a frame its owner resolves.'
			};
		}
	}
	const subject = resolution.subject;
	return {
		kind: 'resolved',
		scope: {
			family: family.id,
			owner: {
				domain: subject.domain,
				subject: { kind: subject.subject.kind, id: subject.subject.id },
				instancePath: [...subject.instancePath],
				location: subject.location,
				componentId: subject.componentId,
				capabilityId: subject.capabilityId
			},
			instancePath: [...address.instancePath],
			componentId: address.componentId,
			capabilityId: address.capabilityId,
			frame: address.frame,
			propertyId: address.propertyId,
			scopeId
		}
	};
}

export type ChannelStaleness = { reason: 'stale-contribution' | 'camera-output-not-held'; message: string; action: string };

/**
 * The one freshness rule: does a contribution still belong to this context? It is
 * stale when a declared `accepted-revision` input names other content than the
 * snapshot holds, when a declared `generation` input names another generation, or
 * — for a `camera-output` property — when the run that offered it no longer holds
 * that output in this session over this source. Negotiation, reads and pruning all
 * ask this one question, so no consumer implements its own cleanup rule.
 */
export function channelContributionStaleness(
	contribution: ChannelContribution,
	context: ChannelEvaluationContext
): ChannelStaleness | null {
	const invalidation = contribution.descriptor.invalidation;
	const content = context.read.snapshot.sourceContentId;
	if (invalidation.includes('accepted-revision')) {
		const computed = contribution.computedFrom.contentRevision;
		if (computed === null || computed !== content) {
			return {
				reason: 'stale-contribution',
				message: `the contribution was computed from content "${computed ?? 'none'}" and the accepted snapshot is content "${content}"`,
				action: 'Recompute the contribution from the supplied accepted snapshot.'
			};
		}
	}
	if (invalidation.includes('generation')) {
		const computed = contribution.computedFrom.generationId;
		if (computed === null || computed !== context.read.generationId) {
			return {
				reason: 'stale-contribution',
				message: `the contribution was computed from generation "${computed ?? 'none'}" and the active generation is "${context.read.generationId ?? 'none'}"`,
				action: 'Re-derive the contribution from the active representation generation.'
			};
		}
	}
	if (contribution.descriptor.arbitration === 'camera-output') {
		const outputs = context.cameraOutputs.filter((output) => output.outputId === contribution.scopeId);
		const notHeld = (message: string): ChannelStaleness => ({
			reason: 'camera-output-not-held',
			message,
			action: 'Acquire the Camera output first, then contribute under the ticket that holds it.'
		});
		if (outputs.length !== 1) {
			return notHeld(
				outputs.length === 0
					? `no Camera output "${contribution.scopeId}" is supplied to this context`
					: `Camera output "${contribution.scopeId}" is supplied more than once, so no one claim holds it`
			);
		}
		const output = outputs[0]!;
		if (output.sessionEpoch !== context.read.sessionEpoch || output.sourceRevision !== content) {
			return notHeld(`Camera output "${output.outputId}" belongs to another host session or source than this context reads`);
		}
		const claim = output.claim;
		if (claim === null || claim.ticket.ownerId !== contribution.invocationId || claim.ticket.runEpoch !== contribution.runEpoch) {
			return notHeld(
				claim === null
					? `Camera output "${output.outputId}" is free`
					: `Camera output "${output.outputId}" is held by run ${claim.ticket.runEpoch} of "${claim.ticket.ownerId}", not run ${contribution.runEpoch} of "${contribution.invocationId}"`
			);
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Negotiation.

function diagnostic(
	domain: ReferenceDomain | null,
	address: ChannelAddress | null,
	owners: readonly string[],
	message: string,
	action: string
): ChannelDiagnostic {
	return { domain, address, owners, message, action };
}

function rejected(state: ChannelState, reason: ChannelRejectionReason, diagnostics: ChannelDiagnostic): ChannelNegotiationOutcome {
	return { kind: 'rejected', state, reason, diagnostics };
}

const RESOLVE_CHOICE = 'Yield one contribution, stop the other writer, or apply a supported combination.';

function markFor(state: ChannelState, scope: ChannelPropertyScope, invocationId: string): ChannelEpochMark | null {
	return state.marks.find((mark) => mark.invocationId === invocationId && sameChannelPropertyScope(mark.scope, scope)) ?? null;
}

/** The highest run epoch any invocation has had accepted in a scope, or `-1`. */
function scopeFloor(state: ChannelState, scope: ChannelPropertyScope): ChannelEpochMark | null {
	let highest: ChannelEpochMark | null = null;
	for (const mark of state.marks) {
		if (sameChannelPropertyScope(mark.scope, scope) && (highest === null || mark.runEpoch > highest.runEpoch)) highest = mark;
	}
	return highest;
}

function withMark(marks: readonly ChannelEpochMark[], next: ChannelEpochMark): ChannelEpochMark[] {
	const kept = marks.filter((mark) => !(mark.invocationId === next.invocationId && sameChannelPropertyScope(mark.scope, next.scope)));
	return [...kept, next];
}

/**
 * How much of one family a scope instance carries among current contributions. A
 * family is usable only when every required property is present; the missing ones
 * are named so a caller can explain the gap instead of evaluating an incomplete
 * inspection. `scope` may name any of the family's properties.
 */
export function channelFamilySatisfaction(
	family: ChannelFamily,
	state: ChannelState,
	scope: ChannelPropertyScope,
	context: ChannelEvaluationContext
): { satisfied: boolean; missingRequiredProperties: readonly string[] } {
	const present = new Set(
		state.entries
			.filter((entry) => sameScopeInstance(entry.scope, scope) && channelContributionStaleness(entry.contribution, context) === null)
			.map((entry) => entry.scope.propertyId)
	);
	const missing = family.requiredProperties.filter((propertyId) => !present.has(propertyId));
	return { satisfied: missing.length === 0, missingRequiredProperties: missing };
}

/**
 * Negotiate one contribution into a state.
 *
 * `input` is the untrusted contribution value; `host` is the admitted family set;
 * `context` is the F.1 read context and live Camera-output ownership.
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
	const refuse = (reason: ChannelRejectionReason, message: string, action: string, owners: readonly string[] = []) =>
		rejected(state, reason, diagnostic(contributionDomain, contribution.address, owners, message, action));

	const family = host.families.find((candidate) => candidate.id === contribution.descriptor.family);
	if (family === undefined) {
		return refuse('unknown-family', `family "${contribution.descriptor.family}" is not declared by this reader`, 'Offer the property through a declared family.');
	}
	// Domain-owned meaning: the family's authority and the address's owner must be the
	// same authority, or neither is authoritative for the property.
	if (family.domain !== contributionDomain) {
		return refuse(
			'domain-mismatch',
			`family "${family.id}" is owned by domain "${family.domain}" and the address is qualified by owner domain "${contributionDomain}"`,
			'Address the property under the owner domain that declares it.'
		);
	}
	const declared = declaredProperty(family, contribution.address.propertyId);
	if (declared === null) {
		return refuse(
			'undeclared-property',
			`family "${family.id}" does not declare property "${contribution.address.propertyId}"`,
			'Offer a property the family publishes.'
		);
	}
	if (!sameDescriptor(declared, contribution.descriptor)) {
		return refuse(
			'descriptor-mismatch',
			`the descriptor does not match the declared "${family.id}" property "${declared.propertyId}"`,
			'Use the family declaration for this property.'
		);
	}

	const resolution = resolveChannelPropertyScope(family, contribution.address, contribution.scopeId, context);
	if (resolution.kind !== 'resolved') return refuse(resolution.reason, resolution.message, resolution.action);
	const scope = resolution.scope;

	const staleness = channelContributionStaleness(contribution, context);
	if (staleness !== null) return refuse(staleness.reason, staleness.message, staleness.action);

	const arbitration = contribution.descriptor.arbitration;
	if (arbitration === 'camera-output' && family.controllerProperty === scope.propertyId) {
		const output = context.cameraOutputs.find((candidate) => candidate.outputId === contribution.scopeId)!;
		const role = output.claim!.role;
		if (contribution.value.kind !== 'identifier' || contribution.value.value !== role) {
			return refuse(
				'invalid-value',
				`the output's resolved controller is the claim's role "${role}"`,
				'Contribute the role the Camera output claim holds, or acquire the output for another role.',
				[output.claim!.ticket.ownerId]
			);
		}
	}

	// Everything in this scope that no longer belongs to the context expires here.
	const inScope = state.entries.filter((entry) => sameChannelPropertyScope(entry.scope, scope));
	const expired = inScope.filter((entry) => channelContributionStaleness(entry.contribution, context) !== null);
	const live = inScope.filter((entry) => !expired.includes(entry));
	const others = state.entries.filter((entry) => !inScope.includes(entry));
	const expiredContributions = expired.map((entry) => entry.contribution);

	const accept = (
		replacedEntries: readonly ChannelEntry[],
		marks: readonly ChannelEpochMark[]
	): ChannelNegotiationOutcome => {
		const kept = live.filter((entry) => !replacedEntries.includes(entry));
		const next: ChannelState = { entries: [...others, ...kept, { scope, contribution }], marks };
		return {
			kind: 'accepted',
			state: next,
			scope,
			contribution,
			replaced: replacedEntries.map((entry) => entry.contribution),
			expired: expiredContributions,
			idempotent: false,
			unavailableFamilies: [],
			...channelFamilySatisfaction(family, next, scope, context)
		};
	};
	const idempotent = (entry: ChannelEntry): ChannelNegotiationOutcome => {
		const next: ChannelState = expired.length === 0 ? state : { entries: [...others, ...live], marks: state.marks };
		return {
			kind: 'accepted',
			state: next,
			scope,
			contribution: entry.contribution,
			replaced: [],
			expired: expiredContributions,
			idempotent: true,
			unavailableFamilies: [],
			...channelFamilySatisfaction(family, next, scope, context)
		};
	};
	const ownMark = markFor(state, scope, contribution.invocationId);
	const advanced = (retire: readonly ChannelEntry[] = []): ChannelEpochMark[] => {
		let marks = withMark(state.marks, { scope, invocationId: contribution.invocationId, runEpoch: contribution.runEpoch, retired: false });
		for (const entry of retire) {
			if (entry.contribution.invocationId === contribution.invocationId) continue;
			marks = withMark(marks, { scope, invocationId: entry.contribution.invocationId, runEpoch: entry.contribution.runEpoch, retired: true });
		}
		return marks;
	};
	const staleRun = (floor: number, owners: readonly string[]) =>
		refuse(
			'stale-run-epoch',
			`run epoch ${contribution.runEpoch} cannot supersede the accepted run epoch ${floor} on "${scope.propertyId}"`,
			RESOLVE_CHOICE,
			owners
		);
	const sameEpochConflict = (owners: readonly string[]) =>
		refuse(
			'same-run-epoch-conflict',
			`run epoch ${contribution.runEpoch} is already accepted for "${scope.propertyId}" with a different value`,
			RESOLVE_CHOICE,
			owners
		);
	/**
	 * One invocation's own ordering: an older run is stale; the same run may re-offer
	 * its value idempotently, or re-offer after its contribution expired, but not
	 * after it was withdrawn or replaced.
	 */
	const ownOrder = (own: ChannelEntry | undefined): ChannelNegotiationOutcome | 'newer' | 'reoffer' => {
		if (ownMark === null || contribution.runEpoch > ownMark.runEpoch) return 'newer';
		if (contribution.runEpoch < ownMark.runEpoch || ownMark.retired) return staleRun(ownMark.runEpoch, [contribution.invocationId]);
		if (own !== undefined && own.contribution.runEpoch === contribution.runEpoch) {
			return sameValue(own.contribution.value, contribution.value) ? idempotent(own) : sameEpochConflict([contribution.invocationId]);
		}
		return 'reoffer';
	};

	if (arbitration === 'union') {
		const own = live.find((entry) => entry.contribution.invocationId === contribution.invocationId);
		const order = ownOrder(own);
		if (typeof order !== 'string') return order;
		return accept(own === undefined ? [] : [own], advanced());
	}

	if (arbitration === 'camera-output') {
		// Freshness proved this run holds the output, and every live entry in the scope is
		// fresh, so the one live entry (if any) is this same claim run's earlier value.
		const holder = live[0];
		if (holder !== undefined && sameValue(holder.contribution.value, contribution.value)) return idempotent(holder);
		return accept(holder === undefined ? [] : [holder], state.marks);
	}

	const holder = live[0];
	if (arbitration === 'exclusive') {
		// An exclusive property is held by one invocation: another invocation cannot take
		// it at any run epoch, and the same invocation may deliberately replace its own.
		if (holder !== undefined && holder.contribution.invocationId !== contribution.invocationId) {
			return refuse(
				'competing-exclusive-contribution',
				`"${scope.propertyId}" is exclusively controlled by another invocation`,
				RESOLVE_CHOICE,
				[holder.contribution.invocationId, contribution.invocationId]
			);
		}
		const order = ownOrder(holder);
		if (typeof order !== 'string') return order;
		return accept(holder === undefined ? [] : [holder], advanced());
	}

	// ordered-replacement: one run order across every invocation in the scope.
	const floor = scopeFloor(state, scope);
	if (floor !== null && contribution.runEpoch <= floor.runEpoch) {
		if (contribution.runEpoch < floor.runEpoch || floor.retired) return staleRun(floor.runEpoch, holder === undefined ? [] : [holder.contribution.invocationId]);
		if (floor.invocationId !== contribution.invocationId) return sameEpochConflict([floor.invocationId, contribution.invocationId]);
		const order = ownOrder(holder);
		if (typeof order !== 'string') return order;
	}
	return accept(holder === undefined ? [] : [holder], advanced(holder === undefined ? [] : [holder]));
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

// ---------------------------------------------------------------------------
// Reading and cleanup.

/**
 * Read one property scope under a context. Stale contributions are never read. A
 * `union` property reads as the union of every current contributor's set, members
 * in stable ID order, with each contributor's own identity and provenance; no
 * aggregate owner or revision is reported.
 */
export function readChannelProperty(
	state: ChannelState,
	scope: ChannelPropertyScope,
	context: ChannelEvaluationContext
): ChannelPropertyRead {
	const current = state.entries
		.filter((entry) => sameChannelPropertyScope(entry.scope, scope) && channelContributionStaleness(entry.contribution, context) === null)
		.sort((left, right) => compareIds(left.contribution.invocationId, right.contribution.invocationId));
	if (current.length === 0) return { kind: 'absent', scope };
	const contributors = current.map((entry) => ({
		invocationId: entry.contribution.invocationId,
		runEpoch: entry.contribution.runEpoch,
		computedFrom: entry.contribution.computedFrom
	}));
	const value =
		current[0]!.contribution.descriptor.arbitration === 'union'
			? unionValues(current.map((entry) => entry.contribution.value))
			: current[0]!.contribution.value;
	return { kind: 'value', scope, value, contributors };
}

/**
 * Withdraw one invocation's own contribution, epoch-qualified. Only the exact run
 * that holds it removes it: a stale completion (an older run of the invocation)
 * is ignored, and another invocation's contribution — including a newer owner's
 * after a replacement — is never touched. Withdrawal retires the run, so neither it
 * nor an older run of the invocation can re-enter the scope afterwards — including
 * when its contribution had already expired and been pruned (`retired`).
 */
export function withdrawChannelContribution(state: ChannelState, handle: ChannelContributionHandle): ChannelWithdrawal {
	const own = state.entries.find(
		(entry) => entry.contribution.invocationId === handle.invocationId && sameChannelPropertyScope(entry.scope, handle.scope)
	);
	if (own === undefined) {
		// Expiry permits re-evaluation; explicit withdrawal retires the run. A run whose
		// contribution already expired and was pruned still has its un-retired mark, and
		// withdrawing it must retire that mark, or a delayed re-offer at the same epoch
		// would be admitted as a re-evaluation.
		const mark = markFor(state, handle.scope, handle.invocationId);
		if (mark === null || mark.retired || mark.runEpoch !== handle.runEpoch) {
			return mark !== null && mark.runEpoch > handle.runEpoch
				? {
						kind: 'ignored',
						state,
						reason: 'stale-run-epoch',
						message: `run ${handle.runEpoch} of "${handle.invocationId}" is older than its accepted run ${mark.runEpoch} on "${handle.scope.propertyId}"`
					}
				: { kind: 'absent', state };
		}
		return { kind: 'retired', state: { entries: state.entries, marks: withMark(state.marks, { ...mark, retired: true }) } };
	}
	if (own.contribution.runEpoch !== handle.runEpoch) {
		return {
			kind: 'ignored',
			state,
			reason: 'stale-run-epoch',
			message: `run ${handle.runEpoch} of "${handle.invocationId}" does not hold "${handle.scope.propertyId}"; run ${own.contribution.runEpoch} does`
		};
	}
	return {
		kind: 'withdrawn',
		state: {
			entries: state.entries.filter((entry) => entry !== own),
			marks: withMark(state.marks, { scope: own.scope, invocationId: handle.invocationId, runEpoch: handle.runEpoch, retired: true })
		},
		contribution: own.contribution
	};
}

/**
 * Drop every contribution that no longer belongs to the context — the shared,
 * epoch-qualified cleanup a host runs when its accepted content, representation
 * generation or Camera-output ownership changes. Run-epoch marks are kept, so
 * ordering survives the cleanup.
 */
export function pruneChannelState(
	state: ChannelState,
	context: ChannelEvaluationContext
): { state: ChannelState; expired: readonly ChannelContribution[] } {
	const expired = state.entries.filter((entry) => channelContributionStaleness(entry.contribution, context) !== null);
	if (expired.length === 0) return { state, expired: [] };
	return {
		state: { entries: state.entries.filter((entry) => !expired.includes(entry)), marks: state.marks },
		expired: expired.map((entry) => entry.contribution)
	};
}
