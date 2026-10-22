/**
 * Experience lowering — one selected Experience + its Camera unit -> the accepted
 * `ExecutionProgram@1` codec (AM-6, T3.P01.S06).
 *
 * Lowering is **derivation**, not a second authored format: it reads the accepted
 * F.2 envelope, resolves every Experience/Presentation/Stop/View/connection
 * binding through the F.1 unit resolvers, and emits a program the shared codec
 * validates. It copies no pose, path, FOV, connection graph, renderer object or
 * source history into the program — a program names a View (`cut`) or a real
 * Camera connection (`travel`), and the Camera authority resolves the rest.
 *
 * Experience 2 carries everything lowering needs, so there is no interim input:
 * the Cut/Travel selector is authored on the continuation edge, a Stop's entry
 * View is its `entryViewId` (or the Presentation's Default), and Presentation
 * text is authored on the Presentation. Lowering never infers Travel from
 * connectivity and never falls back from an unsupported Travel to Cut: a Travel
 * whose pair of Views no Camera connection joins is a typed refusal, and Preview
 * reports the same gap.
 *
 * Lowering also returns a per-edge transition table for every authored approach
 * (Guide adjacency, explicit continuations, detours), so the interpreter
 * validates a Travel against the predecessor the run actually came from; the
 * table is preparation output, not a program field.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import { CAMERA_SESSION_INSPECTION_FAMILY_ID } from '../../channels/families';
import { resolveReference } from '../../references/resolve';
import { createUnitReadContext } from '../../references/unit-resolution';
import type { ReferenceReadContext } from '../../references/types';
import { validateExecutionProgram } from '../../program/validate';
import type {
	ExecutionProgram,
	ProgramAction,
	ProgramCapability,
	ProgramChannelPolicy,
	ProgramContinuation,
	ProgramGuard,
	ProgramInvocation,
	ProgramLifecycleAction,
	ProgramPresentation,
	ProgramStateDeclaration,
	ProgramStop
} from '../../program/types';
import type { Experience, ProjectEnvelope } from '../types';

/** The family the selected Experience's run owns while it is executing. */
const CAMERA_CHANNEL_FAMILY = CAMERA_SESSION_INSPECTION_FAMILY_ID;

export type ExperienceLoweringOptions = {
	readonly experienceId: string;
	/** The accepted snapshot identity this lowering request reads. */
	readonly sourceContentId: string;
	readonly sessionEpoch: string;
	/** Defaults to the selected guide's `entryStopId`. */
	readonly entryStopId?: string;
	/** Selects an authored Guide; defaults to the Experience's entry guide. */
	readonly guideId?: string;
	/**
	 * Must equal the selected Guide's authored `stopIds` exactly. It exists so a
	 * caller can name an order explicitly, never so it can author one: a reordered,
	 * shortened or cross-guide sequence refuses, because Guide order is the one
	 * editorial order authority.
	 */
	readonly order?: readonly string[];
	readonly capabilities?: readonly ProgramCapability[];
	readonly state?: readonly ProgramStateDeclaration[];
	readonly lifecycle?: readonly ProgramLifecycleAction[];
	readonly channels?: readonly ProgramChannelPolicy[];
};

export type ExperienceLoweringRefusal = {
	readonly kind: 'refused';
	readonly code:
		| 'unknown-experience'
		| 'unknown-guide'
		| 'unknown-presentation'
		| 'unknown-stop'
		| 'invalid-order'
		| 'unknown-view'
		| 'missing-entry'
		| 'travel-ambiguous'
		| 'travel-gap'
		| 'invalid-program';
	readonly message: string;
	readonly stopId?: string;
};

/**
 * One validated runtime edge. The interpreter uses these instead of a Stop's
 * Guide-adjacent binding when the run reaches it from a different predecessor.
 * This is preparation output, not a program field: the codec stays unamended.
 */
export type ExperienceProgramTransition = {
	readonly fromStopId: string;
	readonly toStopId: string;
	readonly invocation: ProgramInvocation;
};

export type ExperienceLoweringResult =
	| {
			readonly kind: 'lowered';
			readonly program: ExecutionProgram;
			/** Every authored edge with the invocation that actually starts from its source. */
			readonly transitions: readonly ExperienceProgramTransition[];
			/**
			 * Presentations this Experience carries that no valid Default View makes
			 * enterable. They stay authored and are never silently dropped from the
			 * unit; Preview lists them with their reason instead of entering them.
			 */
			readonly unavailablePresentations: readonly {
				readonly presentationId: string;
				readonly reason: 'no-default-view' | 'unresolved-default-view';
			}[];
	  }
	| ExperienceLoweringRefusal;

function refuse(
	code: ExperienceLoweringRefusal['code'],
	message: string,
	stopId?: string
): ExperienceLoweringRefusal {
	return stopId === undefined ? { kind: 'refused', code, message } : { kind: 'refused', code, message, stopId };
}

function reference(
	domain: 'camera' | 'experience',
	kind: string,
	id: string,
	revision: string,
	instancePath: readonly string[]
) {
	return {
		version: 1 as const,
		domain,
		revision: { kind: 'exact' as const, contentRevision: revision },
		subject: { kind, id },
		instancePath,
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null
	};
}

function resolves(context: ReferenceReadContext, candidate: unknown): boolean {
	return resolveReference(candidate, context).kind === 'resolved';
}

/**
 * Lower one Experience.
 *
 * Refusals are typed results, never throws; a program that fails the shared codec
 * is refused as `invalid-program` rather than returned. The output order is the
 * entry guide's order (or the caller's explicit order), because Guide order — not
 * array order — is the one editorial sequence.
 */
export function lowerExperienceProgram(
	envelope: ProjectEnvelope,
	options: ExperienceLoweringOptions
): ExperienceLoweringResult {
	const experience = envelope.units.experience.data.experiences.find((entry) => entry.id === options.experienceId);
	if (experience === undefined) {
		return refuse('unknown-experience', `the envelope carries no Experience "${options.experienceId}"`);
	}
	const context = createUnitReadContext({
		envelope,
		sourceContentId: options.sourceContentId,
		sessionEpoch: options.sessionEpoch
	});
	const cameraRevision = envelope.units.camera.header.contentRevision;
	const entryGuide = experience.guides.find((guide) => guide.id === experience.entryGuideId) ?? null;
	const selectedGuide = options.guideId === undefined
		? entryGuide
		: experience.guides.find((guide) => guide.id === options.guideId) ?? null;
	if (options.guideId !== undefined && selectedGuide === null) {
		return refuse('unknown-guide', `this Experience carries no Guide "${options.guideId}"`);
	}
	if (options.order !== undefined) {
		// An explicit order is a claim about the **selected** authored Guide, never a
		// second editable sequence: it must match that Guide's stopIds exactly. A
		// sequence from another Guide would mix one Guide's entry with another's order.
		const authored = selectedGuide !== null &&
			selectedGuide.stopIds.length === options.order.length &&
			selectedGuide.stopIds.every((stopId, index) => stopId === options.order![index]);
		if (!authored) {
			return refuse(
				'invalid-order',
				`the lowering order must equal the selected Guide${
					selectedGuide === null ? '' : ` "${selectedGuide.id}"`
				}'s authored stopIds exactly; supply its guideId and authored order, never a supplied sequence`
			);
		}
	}
	const order = [...(options.order ?? selectedGuide?.stopIds ?? [])];

	if (order.length === 0 && experience.stops.length > 0) {
		return refuse('missing-entry', 'the Experience has Stops but no Guide order; select a guide or supply its authored order');
	}
	const stopById = new Map(experience.stops.map((stop) => [stop.id, stop]));
	for (const stopId of order) {
		if (!stopById.has(stopId)) {
			return refuse('unknown-stop', `the lowering order names Stop "${stopId}", which this Experience does not carry`, stopId);
		}
	}
	const entryStopId = options.entryStopId ?? selectedGuide?.entryStopId ?? order[0] ?? null;
	if (order.length === 0 && entryStopId !== null) {
		return refuse('missing-entry', 'an empty program cannot declare an entry Stop');
	}
	if (entryStopId !== null && !order.includes(entryStopId)) {
		return refuse('unknown-stop', `the entry Stop "${entryStopId}" is not in the lowered order`, entryStopId);
	}

	const presentationById = new Map(experience.presentations.map((presentation) => [presentation.id, presentation]));
	// A Presentation may exist without a Guide (AM-9). Lowering emits every
	// **enterable** Presentation this Experience carries, not only those a selected
	// Guide's Stops use, so a guide-free Presentation stays reachable to DOM
	// navigation and camera handoff. A Presentation with no Default View, or whose
	// Default does not resolve, is not enterable: it stays authored and is reported
	// as unavailable rather than dropped, retargeted or given an invented View.
	const presentations: ProgramPresentation[] = [];
	const unavailablePresentations: {
		readonly presentationId: string;
		readonly reason: 'no-default-view' | 'unresolved-default-view';
	}[] = [];
	for (const presentation of experience.presentations) {
		if (presentation.defaultViewId === null || presentation.viewIds.length === 0) {
			unavailablePresentations.push({ presentationId: presentation.id, reason: 'no-default-view' });
			continue;
		}
		const resolvedViewIds = presentation.viewIds.filter((viewId) =>
			resolves(context, reference('camera', 'view', viewId, cameraRevision, []))
		);
		if (!resolvedViewIds.includes(presentation.defaultViewId)) {
			unavailablePresentations.push({ presentationId: presentation.id, reason: 'unresolved-default-view' });
			continue;
		}
		presentations.push({
			id: presentation.id,
			label: presentation.label,
			viewIds: resolvedViewIds,
			defaultViewId: presentation.defaultViewId,
			content: presentation.text === null
				? []
				: [{ id: `${presentation.id}:text`, kind: 'text', text: presentation.text.body }]
		});
	}

	const entryOccurrence = entryStopId === null ? -1 : order.indexOf(entryStopId);
	const presentationOf = (stop: Experience['stops'][number]) => presentationById.get(stop.presentationId) ?? null;
	/** The View one Stop occurrence enters at: its entry View or the Default. */
	const entryViewOf = (stop: Experience['stops'][number]): string | null => {
		const presentation = presentationOf(stop);
		return stop.entryViewId ?? presentation?.defaultViewId ?? null;
	};
	const travelConnection = (fromViewId: string | null, toViewId: string | null):
		| { readonly kind: 'resolved'; readonly connectionId: string }
		| { readonly kind: 'none' }
		| { readonly kind: 'ambiguous' } => {
		if (fromViewId === null || toViewId === null) return { kind: 'none' };
		const matches = envelope.units.camera.data.connections.filter(
			(connection) =>
				(connection.fromNodeId === fromViewId && connection.toNodeId === toViewId) ||
				(connection.fromNodeId === toViewId && connection.toNodeId === fromViewId)
		);
		const resolved = matches.filter((connection) =>
			resolves(context, reference('camera', 'connection', connection.id, cameraRevision, []))
		);
		if (resolved.length === 0) return { kind: 'none' };
		if (resolved.length > 1) return { kind: 'ambiguous' };
		return { kind: 'resolved', connectionId: resolved[0]!.id };
	};
	/**
	 * The invocation for arriving at `target` from `previous`. Cut is the authored
	 * default; a Travel names the one Camera connection joining the two Views and is
	 * refused (never downgraded to a Cut) when the pair has none.
	 */
	const resolveApproach = (
		previous: Experience['stops'][number],
		target: Experience['stops'][number],
		transition: 'cut' | 'travel' | undefined,
		label: string
	): { readonly kind: 'resolved'; readonly invocation: ProgramInvocation } | ExperienceLoweringRefusal => {
		const targetViewId = entryViewOf(target);
		if (targetViewId === null) {
			return refuse('missing-entry', `${label} enters Stop "${target.id}", which has no entry View`, target.id);
		}
		if (transition !== 'travel') {
			return { kind: 'resolved', invocation: { kind: 'cut', viewId: targetViewId } };
		}
		const connection = travelConnection(entryViewOf(previous), targetViewId);
		if (connection.kind === 'ambiguous') {
			return refuse(
				'travel-ambiguous',
				`${label} binds a Travel, and more than one Camera connection joins "${entryViewOf(previous) ?? '?'}" to "${targetViewId}"; Experience never chooses between them`,
				target.id
			);
		}
		if (connection.kind === 'none') {
			return refuse(
				'travel-gap',
				`${label} binds a Travel, and no Camera connection joins "${entryViewOf(previous) ?? '?'}" to "${targetViewId}"`,
				target.id
			);
		}
		return { kind: 'resolved', invocation: { kind: 'travel', connectionId: connection.connectionId } };
	};
	/**
	 * The transition an adjacent pair authors. Only a `sequence-next` continuation
	 * (or its absence) describes Guide adjacency; a Stop that continues elsewhere is
	 * not the authored edge into the next list entry, which is then a Cut.
	 */
	const adjacentTransition = (
		previous: Experience['stops'][number],
		target: Experience['stops'][number]
	) => {
		const continuation = previous.continuation;
		if (continuation === undefined || continuation.kind === 'sequence-next') {
			return continuation?.transition ?? ('cut' as const);
		}
		if (continuation.kind === 'stop' && continuation.stopId === target.id) {
			return continuation.transition ?? ('cut' as const);
		}
		return 'cut' as const;
	};
	const stops: ProgramStop[] = [];
	const localTime: { stopId: string; holdSeconds: number }[] = [];
	for (const [occurrence, stopId] of order.entries()) {
		const stop = stopById.get(stopId)!;
		const presentation = presentationById.get(stop.presentationId);
		if (presentation === undefined) {
			return refuse(
				'unknown-presentation',
				`Stop "${stop.id}" names Presentation "${stop.presentationId}", which this Experience does not carry`,
				stop.id
			);
		}
		const entryViewId = entryViewOf(stop);
		if (entryViewId === null) {
			return refuse(
				'missing-entry',
				`Stop "${stop.id}" has no entry View: its Presentation has no Default View and the Stop names none`,
				stop.id
			);
		}
		if (!resolves(context, reference('camera', 'view', entryViewId, cameraRevision, []))) {
			return refuse(
				'unknown-view',
				`Stop "${stop.id}" enters at Camera view "${entryViewId}", which this envelope does not resolve`,
				stop.id
			);
		}
		const previous = occurrence === 0 ? null : stopById.get(order[occurrence - 1]!)!;
		const approach = previous === null
			? { kind: 'resolved' as const, invocation: { kind: 'cut' as const, viewId: entryViewId } }
			: resolveApproach(previous, stop, adjacentTransition(previous, stop), `Guide adjacency into Stop "${stop.id}"`);
		if (approach.kind === 'refused') return approach;
		stops.push({
			id: stop.id,
			presentationId: stop.presentationId,
			viewId: entryViewId,
			invocation: approach.invocation,
			holdSeconds: stop.holdSeconds ?? null,
			continuation: toProgramContinuation(stop.continuation)
		});
		if (stop.holdSeconds !== undefined) {
			localTime.push({ stopId: stop.id, holdSeconds: stop.holdSeconds });
		}
	}
	for (const stop of stops) {
		if (stop.continuation.kind === 'stop' && !order.includes(stop.continuation.stopId)) {
			return refuse(
				'unknown-stop',
				`Stop "${stop.id}" continues to Stop "${stop.continuation.stopId}", which is not in the lowered order`,
				stop.id
			);
		}
	}

	// Every authored edge is validated against the real Camera connections: Guide
	// adjacency, each explicit Stop continuation, and each authored detour (out and
	// back). A runtime jump outside this table may Cut, but a Travel is never
	// borrowed from another predecessor's connection.
	const transitionByKey = new Map<string, ExperienceProgramTransition>();
	const addTransition = (
		fromStopId: string,
		toStopId: string,
		invocation: ProgramInvocation
	): void => {
		const key = `${fromStopId}\u0000${toStopId}`;
		if (transitionByKey.has(key)) return;
		transitionByKey.set(key, { fromStopId, toStopId, invocation });
	};
	for (const [index, stop] of stops.entries()) {
		if (index === 0) continue;
		addTransition(stops[index - 1]!.id, stop.id, stop.invocation);
	}
	for (const stop of stops) {
		if (stop.continuation.kind !== 'stop') continue;
		const targetId = stop.continuation.stopId;
		const target = stops.find((entry) => entry.id === targetId);
		const authored = stopById.get(stop.id)!;
		const targetStop = stopById.get(targetId);
		if (target === undefined || targetStop === undefined) continue;
		const authoredContinuation = authored.continuation;
		const transition =
			authoredContinuation !== undefined && authoredContinuation.kind === 'stop'
				? authoredContinuation.transition
				: undefined;
		const approach = resolveApproach(
			authored,
			targetStop,
			transition,
			`The explicit continuation from Stop "${stop.id}" to "${targetId}"`
		);
		if (approach.kind === 'refused') return approach;
		addTransition(stop.id, targetId, approach.invocation);
	}
	for (const detour of experience.detours) {
		// A detour authored on a Stop outside this Guide's order is not an edge of
		// this program; runtime policy still refuses a dangling identity.
		const out = stops.find((entry) => entry.id === detour.toStopId);
		const back = stops.find((entry) => entry.id === detour.returnToStopId);
		if (out === undefined || back === undefined) continue;
		addTransition(detour.fromStopId, detour.toStopId, { kind: 'cut', viewId: entryViewOf(stopById.get(detour.toStopId)!)! });
		addTransition(detour.toStopId, detour.returnToStopId, { kind: 'cut', viewId: entryViewOf(stopById.get(detour.returnToStopId)!)! });
	}

	const program: ExecutionProgram = {
		kind: 'execution-program',
		formatVersion: 2,
		capabilities: options.capabilities ?? [],
		experienceId: experience.id,
		entryStopId,
		presentations,
		stops,
		state: options.state ?? [],
		localTime,
		channels: options.channels ?? [
			{ id: 'camera-output', family: CAMERA_CHANNEL_FAMILY, policy: 'exclusive' }
		],
		lifecycle: options.lifecycle ?? [],
		profile: { reducedMotion: 'required', semanticDomNavigation: 'required' }
	};
	const validated = validateExecutionProgram(program);
	if (!validated.success) {
		const first = validated.issues[0];
		return refuse(
			'invalid-program',
			first === undefined ? 'the lowered program is not a valid ExecutionProgram@2' : `${first.path} (${first.code}): ${first.message}`
		);
	}
	return {
		kind: 'lowered',
		program: validated.value,
		transitions: [...transitionByKey.values()],
		unavailablePresentations
	};
}

function toProgramContinuation(continuation: Experience['stops'][number]['continuation']): ProgramContinuation {
	if (continuation === undefined || continuation.kind === 'sequence-next') return { kind: 'sequence-next' };
	if (continuation.kind === 'end') return { kind: 'end' };
	return { kind: 'stop', stopId: continuation.stopId };
}

/** Narrow helper for a caller that wants the refusal's own diagnostic list. */
export type ExperienceLoweringAction = ProgramAction;
