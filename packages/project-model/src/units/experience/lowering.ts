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
 * Two inputs are deliberately explicit because the ratified `Experience@1` shape
 * does not carry them:
 *
 * - **invocation bindings** — Cut versus Travel is editorial intent. Lowering
 *   never infers Travel from connectivity and never falls back from a missing
 *   Travel to Cut. A binding is `{stopId, occurrence?, invocation}`; the entry
 *   stop may omit it (Cut to its View). A missing binding for a non-entry
 *   occurrence refuses.
 * - **presentation content** — `ProgramPresentation.content` is a required
 *   program field, while `ExperiencePresentation` carries only `label` and
 *   `viewId`. The caller supplies the text records it has; an absent map means an
 *   explicitly empty panel, not invented copy.
 *
 * The authored selector and content binding are a contract decision for
 * `T3.P01.S04`/`T3.P02`; naming them here is the disclosed interim input, not a
 * persisted format. Runtime-safe: no editor, renderer, Svelte or Three import.
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

export type ExperienceInvocationBinding = {
	readonly stopId: string;
	/** Zero-based position in the lowered order; disambiguates a repeated Stop. */
	readonly occurrence?: number;
	readonly invocation: ProgramInvocation;
};

export type ExperienceLoweringContent = {
	/** Text records for one Presentation, in display order. */
	readonly presentationId: string;
	readonly records: readonly { readonly id: string; readonly text: string }[];
};

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
	readonly bindings?: readonly ExperienceInvocationBinding[];
	readonly content?: readonly ExperienceLoweringContent[];
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
		| 'missing-binding'
		| 'duplicate-binding'
		| 'invalid-binding'
		| 'travel-gap'
		| 'invalid-program';
	readonly message: string;
	readonly stopId?: string;
};

export type ExperienceLoweringResult =
	| { readonly kind: 'lowered'; readonly program: ExecutionProgram }
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
	const experienceRevision = envelope.units.experience.header.contentRevision;
	const cameraRevision = envelope.units.camera.header.contentRevision;
	const entryGuide = experience.guides.find((guide) => guide.id === experience.entryGuideId) ?? null;
	const selectedGuide = options.guideId === undefined
		? entryGuide
		: experience.guides.find((guide) => guide.id === options.guideId) ?? null;
	if (options.guideId !== undefined && selectedGuide === null) {
		return refuse('unknown-guide', `this Experience carries no Guide "${options.guideId}"`);
	}
	if (options.order !== undefined) {
		// An explicit order is a claim about the authored Guide, never a second
		// editable sequence: it must match one Guide's stopIds exactly.
		const authored = experience.guides.some((guide) =>
			guide.stopIds.length === options.order!.length &&
			guide.stopIds.every((stopId, index) => stopId === options.order![index])
		);
		if (!authored) {
			return refuse('invalid-order', 'the lowering order must equal an authored Guide\'s stopIds exactly; Experience order is authored, not supplied');
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
	const contentByPresentation = new Map(options.content?.map((entry) => [entry.presentationId, entry.records]) ?? []);
	const presentations: ProgramPresentation[] = [];
	const usedPresentationIds = new Set(order.map((stopId) => stopById.get(stopId)!.presentationId));
	for (const presentationId of usedPresentationIds) {
		const presentation = presentationById.get(presentationId);
		if (presentation === undefined) {
			return refuse('unknown-presentation', `the lowered order uses Presentation "${presentationId}", which this Experience does not carry`);
		}
		if (!resolves(context, reference('camera', 'view', presentation.viewId, cameraRevision, []))) {
			return refuse(
				'unknown-view',
				`Presentation "${presentation.id}" names Camera view "${presentation.viewId}", which this envelope does not resolve`
			);
		}
		presentations.push({
			id: presentation.id,
			label: presentation.label,
			viewId: presentation.viewId,
			content: (contentByPresentation.get(presentation.id) ?? []).map((record) => ({
				id: record.id,
				kind: 'text',
				text: record.text
			}))
		});
	}

	const indexed = indexBindings(options.bindings ?? []);
	if (indexed.duplicate !== null) {
		return refuse(
			'duplicate-binding',
			`Stop "${indexed.duplicate.stopId}" declares more than one invocation binding for the same occurrence`,
			indexed.duplicate.stopId
		);
	}
	const bindings = indexed.index;
	const stops: ProgramStop[] = [];
	const localTime: { stopId: string; holdSeconds: number }[] = [];
	let previousViewId: string | null = null;
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
		const invocation = resolveInvocation(envelope, context, cameraRevision, stop, presentation.viewId, occurrence, previousViewId, bindings);
		if (invocation.kind === 'refused') return invocation;
		stops.push({
			id: stop.id,
			presentationId: stop.presentationId,
			invocation: invocation.invocation,
			holdSeconds: stop.holdSeconds ?? null,
			continuation: toProgramContinuation(stop.continuation)
		});
		if (stop.holdSeconds !== undefined) {
			localTime.push({ stopId: stop.id, holdSeconds: stop.holdSeconds });
		}
		previousViewId = presentation.viewId;
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

	const program: ExecutionProgram = {
		kind: 'execution-program',
		formatVersion: 1,
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
			first === undefined ? 'the lowered program is not a valid ExecutionProgram@1' : `${first.path} (${first.code}): ${first.message}`
		);
	}
	return { kind: 'lowered', program: validated.value };
}

function indexBindings(
	bindings: readonly ExperienceInvocationBinding[]
): {
	readonly index: Map<string, ExperienceInvocationBinding>;
	readonly duplicate: ExperienceInvocationBinding | null;
} {
	const index = new Map<string, ExperienceInvocationBinding>();
	for (const binding of bindings) {
		const key = bindingKey(binding.stopId, binding.occurrence);
		if (index.has(key)) return { index, duplicate: binding };
		index.set(key, binding);
	}
	return { index, duplicate: null };
}

function bindingKey(stopId: string, occurrence: number | undefined): string {
	return occurrence === undefined ? `stop:${stopId}` : `occurrence:${stopId}:${occurrence}`;
}

/**
 * Resolve one Stop occurrence's Camera invocation. The entry occurrence is a Cut
 * to its View unless the caller explicitly bound it; every later occurrence must
 * be bound, and a Travel binding must name a real Camera connection between the
 * previous View and this one — never the reverse of a missing edge.
 */
function resolveInvocation(
	envelope: ProjectEnvelope,
	context: ReferenceReadContext,
	cameraRevision: string,
	stop: Experience['stops'][number],
	viewId: string,
	occurrence: number,
	previousViewId: string | null,
	bindings: ReadonlyMap<string, ExperienceInvocationBinding>
): { readonly kind: 'resolved'; readonly invocation: ProgramInvocation } | ExperienceLoweringRefusal {
	const binding = bindings.get(bindingKey(stop.id, occurrence)) ?? bindings.get(bindingKey(stop.id, undefined));
	if (binding === undefined) {
		if (occurrence === 0) return { kind: 'resolved', invocation: { kind: 'cut', viewId } };
		return refuse(
			'missing-binding',
			`Stop "${stop.id}" at occurrence ${occurrence} declares no Cut/Travel binding; lowering never infers one`,
			stop.id
		);
	}
	if (binding.invocation.kind === 'cut') {
		if (binding.invocation.viewId !== viewId) {
			return refuse(
				'invalid-binding',
				`Stop "${stop.id}" binds a Cut to view "${binding.invocation.viewId}", but its Presentation uses "${viewId}"`,
				stop.id
			);
		}
		return { kind: 'resolved', invocation: { kind: 'cut', viewId } };
	}
	if (previousViewId === null) {
		return refuse(
			'invalid-binding',
			`Stop "${stop.id}" is the entry occurrence and cannot bind a Travel; enter through a Cut`,
			stop.id
		);
	}
	// Destructured after the Cut branch: the narrowing must not be lost inside
	// the find callback below.
	const invocation = binding.invocation;
	// Connection closure is F.1's answer, not a local array scan: the resolver
	// checks the subject and its unit revision against this exact snapshot.
	const connectionResolution = resolveReference(
		reference('camera', 'connection', invocation.connectionId, cameraRevision, []),
		context
	);
	if (connectionResolution.kind === 'failed') {
		return refuse(
			'travel-gap',
			`Stop "${stop.id}" binds Travel over connection "${invocation.connectionId}", which this envelope does not resolve: ${connectionResolution.message}`,
			stop.id
		);
	}
	const connection = envelope.units.camera.data.connections.find(
		(candidate) => candidate.id === invocation.connectionId
	);
	if (connection === undefined) {
		return refuse('travel-gap', `Stop "${stop.id}" binds Travel over connection "${invocation.connectionId}", which this envelope does not carry`, stop.id);
	}
	const forward = connection.fromNodeId === previousViewId && connection.toNodeId === viewId;
	const reverse = connection.fromNodeId === viewId && connection.toNodeId === previousViewId;
	if (!forward && !reverse) {
		return refuse(
			'travel-gap',
			`Travel to Stop "${stop.id}" needs a Camera connection between "${previousViewId}" and "${viewId}"; connection "${connection.id}" joins "${connection.fromNodeId}" and "${connection.toNodeId}"`,
			stop.id
		);
	}
	return { kind: 'resolved', invocation: { kind: 'travel', connectionId: connection.id } };
}

function toProgramContinuation(continuation: Experience['stops'][number]['continuation']): ProgramContinuation {
	if (continuation === undefined || continuation.kind === 'sequence-next') return { kind: 'sequence-next' };
	if (continuation.kind === 'end') return { kind: 'end' };
	return { kind: 'stop', stopId: continuation.stopId };
}

/** Narrow helper for a caller that wants the refusal's own diagnostic list. */
export type ExperienceLoweringAction = ProgramAction;
