/**
 * The sole current-source converter (AM-7) — pure, inactive preparation.
 *
 * It reads exactly the strict post-#115 pair, retains every identity and byte
 * value it can, and produces **candidates**: a complete F.2 envelope plus a
 * mapping report, or typed refusals. It installs nothing, is wired to no route,
 * touches no clock or randomness and never mutates its input, so identical
 * captured inputs replay to identical candidates and an identical report.
 *
 * The division of labour is the point. The converter decides *no* policy: every
 * ambiguous row of the conversion matrix requires a supplied decision, and a
 * source that needs one it does not have is refused with
 * `requires-policy-mapping`. Authored data is never silently dropped and never
 * guessed into a plausible-looking meaning — a legacy `lockInteraction`, a
 * non-zero View-key hold and a detour all either carry a reviewed decision or
 * stop the conversion.
 *
 * Deterministic identities: a Stop is `stop:<legacy node id>`, a Presentation is
 * `presentation:<legacy node id>` and a Guide is `guide:<first node id>`. They
 * are derived from the preserved View identity — never from an array index, a
 * label or a pose — so a reviewer can name an entry Stop before conversion runs,
 * and a repeat visit keeps the same Stop identity.
 */

import { validateProject } from '../project-codec';
import type { ProjectDocument } from '../project-types';
import { validateAcceptedRevision } from '../references/validate';
import type { ReferenceDomain, SemanticReference } from '../references/types';
import type { SceneConnection, SceneNavigationNode } from '../scene';
import { computeUnitContentRevision, createProjectEnvelope } from '../units/canonical';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_DOMAINS,
	type CameraFreeSceneDocument,
	type DependencyLockEntry,
	type Experience,
	type ExperienceContinuation,
	type ExperienceDetour,
	type ExperienceGate,
	type ExperiencePresentation,
	type ExperienceStop,
	type RequiredCapability,
	type TypedResource,
	type UnitDomain
} from '../units/types';
import { validateProjectEnvelope } from '../units/validate';
import type {
	LockInteractionDecision,
	MigrationInput,
	MigrationRefusal,
	MigrationRefusalCode,
	MigrationReport,
	MigrationResult
} from './types';

/** The capability every produced lock entry requires: the envelope's own format. */
const F2_REQUIREMENT: RequiredCapability = { id: 'F2.unit-envelope', version: '1' };

function refuse(
	code: MigrationRefusalCode,
	path: string,
	message: string,
	action: string
): { kind: 'refused'; refusals: MigrationRefusal[] } {
	return { kind: 'refused', refusals: [{ code, path, message, action }] };
}

function stopIdOf(nodeId: string): string {
	return `stop:${nodeId}`;
}

function presentationIdOf(nodeId: string): string {
	return `presentation:${nodeId}`;
}

function viewIdOf(nodeId: string): string {
	return nodeId;
}

function lockDomainFor(domain: UnitDomain): ReferenceDomain {
	return domain === 'resources' ? 'resource:registry' : domain;
}

/** The reference domain an admitted resource kind is addressed by. */
function resourceDomain(kind: TypedResource['kind']): ReferenceDomain {
	return kind === 'texture' ? 'resource:texture' : 'resource:asset';
}

/** The binding a texture carries when its bytes are not staged yet. */
function resourceReference(textureId: string, sourceContentId: string): SemanticReference {
	return {
		version: 1,
		domain: 'resource:texture',
		revision: { kind: 'exact', contentRevision: sourceContentId },
		subject: { kind: 'resource', id: textureId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

type Component = { nodeIds: string[]; cycle: boolean };

/**
 * Ordered components of the legacy order links.
 *
 * A chain head (`previousNodeId` absent) starts a linear component. Any ordered
 * node no head reached is a **residual cycle**: the old codec admits it, the old
 * runtime cannot explain it, and it therefore needs a supplied entry choice
 * before it can become a Guide.
 */
function componentsOf(
	nodes: readonly SceneNavigationNode[],
	nodeById: ReadonlyMap<string, SceneNavigationNode>
): Component[] {
	const ordered = nodes.filter((node) => node.nextNodeId !== undefined || node.previousNodeId !== undefined);
	const visited = new Set<string>();
	const components: Component[] = [];
	for (const head of ordered) {
		if (head.previousNodeId !== undefined) continue;
		const nodeIds: string[] = [];
		let current: SceneNavigationNode | undefined = head;
		while (current !== undefined && !visited.has(current.id)) {
			visited.add(current.id);
			nodeIds.push(current.id);
			const nextId: string | undefined = current.nextNodeId;
			current = nextId === undefined ? undefined : nodeById.get(nextId);
		}
		components.push({ nodeIds, cycle: false });
	}
	for (const node of ordered) {
		if (visited.has(node.id)) continue;
		const nodeIds: string[] = [];
		let current: SceneNavigationNode | undefined = node;
		while (current !== undefined && !visited.has(current.id)) {
			visited.add(current.id);
			nodeIds.push(current.id);
			const nextId: string | undefined = current.nextNodeId ?? current.previousNodeId;
			current = nextId === undefined ? undefined : nodeById.get(nextId);
		}
		components.push({ nodeIds, cycle: true });
	}
	return components;
}

/** The one connection that traverses `from → to`, or `null` when none is unique. */
function uniqueConnection(
	connections: readonly SceneConnection[],
	fromId: string,
	toId: string
): SceneConnection | null {
	const matches = connections.filter((connection) => connection.fromNodeId === fromId && connection.toNodeId === toId);
	return matches.length === 1 ? matches[0]! : null;
}

export async function prepareSourceMigration(input: MigrationInput): Promise<MigrationResult> {
	const baseline = input.baseline;
	if (baseline.projectId.trim() === '' || baseline.sourceContentId.trim() === '') {
		return refuse(
			'missing-baseline',
			'$.baseline',
			'the captured migration baseline has no project id or no source-content identity',
			'Capture the baseline (project id, source-content identity, stored version) before preparing a conversion.'
		);
	}
	if (input.acceptedRevision === null) {
		return refuse(
			'missing-revision',
			'$.acceptedRevision',
			'the conversion baseline carries no accepted revision',
			'Capture the accepted revision the source was read at; a conversion never installs against an inferred revision.'
		);
	}
	const revision = validateAcceptedRevision(input.acceptedRevision);
	if (!revision.success || revision.value.projectId !== baseline.projectId) {
		return refuse(
			'missing-revision',
			'$.acceptedRevision',
			`the accepted revision is not a valid revision of project "${baseline.projectId}"`,
			'Re-capture the accepted revision from the same project as the baseline.'
		);
	}

	const validated = validateProject(input.source);
	if (!validated.success) {
		const unsupported = validated.issues.some((issue) => issue.code.includes('unsupported'));
		return {
			kind: 'refused',
			refusals: validated.issues.map((issue) => ({
				code: (unsupported ? 'unsupported-unit' : 'invalid-source') as MigrationRefusalCode,
				path: issue.path,
				message: issue.message,
				action: 'Convert only a valid post-#115 source pair; a malformed or other-format document is never reinterpreted.'
			}))
		};
	}
	const project: ProjectDocument = validated.project;
	if (project.id !== baseline.projectId) {
		return refuse(
			'missing-baseline',
			'$.id',
			`the source is project "${project.id}" and the baseline names "${baseline.projectId}"`,
			'Prepare the conversion against the baseline captured for this project.'
		);
	}

	const nodes = project.scene.navigationNodes;
	const connections = project.scene.connections;
	const nodeById = new Map<string, SceneNavigationNode>();
	for (const node of nodes) {
		if (nodeById.has(node.id)) {
			return refuse(
				'duplicate-identity',
				'$.scene.navigationNodes',
				`node "${node.id}" is declared twice`,
				'Repair the duplicated ids before converting; a duplicate would collapse two occurrences into one identity.'
			);
		}
		nodeById.set(node.id, node);
	}

	// Legacy links must be resolvable and mutual. An asymmetric link is not
	// repairable by the converter: it would have to choose which side is right.
	for (const node of nodes) {
		for (const targetId of node.connectedNodeIds) {
			const target = nodeById.get(targetId);
			if (target === undefined) {
				return refuse(
					'invalid-source',
					`$.scene.navigationNodes["${node.id}"].connectedNodeIds`,
					`node "${node.id}" is connected to unknown node "${targetId}"`,
					'Repair the connectivity before converting.'
				);
			}
			if (!target.connectedNodeIds.includes(node.id)) {
				return refuse(
					'asymmetric-links',
					`$.scene.navigationNodes["${node.id}"].connectedNodeIds`,
					`node "${node.id}" declares "${targetId}" and "${targetId}" does not declare "${node.id}"`,
					'Repair the connectivity to a mutual declaration; the converter never picks one side of an asymmetric link.'
				);
			}
		}
		if (node.nextNodeId !== undefined) {
			const next = nodeById.get(node.nextNodeId);
			if (next === undefined || next.previousNodeId !== node.id) {
				return refuse(
					'asymmetric-links',
					`$.scene.navigationNodes["${node.id}"].nextNodeId`,
					`node "${node.id}" continues to "${node.nextNodeId}" without a reciprocal previous link`,
					'Repair the order links before converting; an unmatched link is not a sequence.'
				);
			}
		}
		if (node.previousNodeId !== undefined) {
			const previous = nodeById.get(node.previousNodeId);
			if (previous === undefined || previous.nextNodeId !== node.id) {
				return refuse(
					'asymmetric-links',
					`$.scene.navigationNodes["${node.id}"].previousNodeId`,
					`node "${node.id}" follows "${node.previousNodeId}" without a reciprocal next link`,
					'Repair the order links before converting.'
				);
			}
		}
	}

	const components = componentsOf(nodes, nodeById);
	const needsEntryChoice = components.length > 1 || components.some((component) => component.cycle);
	if (needsEntryChoice && input.policy.entry === null) {
		return refuse(
			'requires-policy-mapping',
			'$.policy.entry',
			components.length > 1
				? `the source carries ${components.length} open order components; the old codec admits more than its runtime can explain`
				: 'the source carries a residual order cycle and no sequence head',
			'Supply the entry choice (experience id and entry Stop id) that names the intended main Guide.'
		);
	}

	const stopNodeIds: string[] = components.flatMap((component) => component.nodeIds);
	const entryStopIdFromPolicy = input.policy.entry?.entryStopId ?? null;
	if (entryStopIdFromPolicy !== null && !stopNodeIds.includes(entryStopIdFromPolicy.replace(/^stop:/, ''))) {
		return refuse(
			'policy-mismatch',
			'$.policy.entry.entryStopId',
			`the entry choice names "${entryStopIdFromPolicy}", which is not an ordered occurrence of this source`,
			'Name one of the source\'s ordered occurrences (its Stop id is "stop:<node id>").'
		);
	}

	// Detour decisions bring their own Stops: a singleton detour target is not an
	// ordered occurrence, and it still needs a stable occurrence identity.
	const detourNodeIds = nodes
		.filter((node) => node.detourOfNodeId !== undefined)
		.map((node) => node.id);
	for (const node of nodes) {
		if (node.detourOfNodeId === undefined) continue;
		const decision = input.policy.detours[node.id];
		if (decision === undefined) {
			return refuse(
				'requires-policy-mapping',
				`$.policy.detours["${node.id}"]`,
				`node "${node.id}" is a detour of "${node.detourOfNodeId}" and carries no reviewed mapping`,
				'Supply the explicit from/to/return Stop relationship for this detour.'
			);
		}
		const origin = nodeById.get(node.detourOfNodeId);
		if (origin === undefined || origin.id === node.id) {
			return refuse(
				'ambiguous-origin',
				`$.scene.navigationNodes["${node.id}"].detourOfNodeId`,
				`detour "${node.id}" names "${node.detourOfNodeId}", which is not a distinct origin occurrence`,
				'Name a distinct originating occurrence, or repair the authored detour.'
			);
		}
		const nested = nodes.some((candidate) => candidate.detourOfNodeId === node.id);
		if (nested) {
			return refuse(
				'ambiguous-origin',
				`$.scene.navigationNodes["${node.id}"].detourOfNodeId`,
				`detour "${node.id}" is itself the origin of another detour`,
				'Flatten or explicitly model the nested detour; a nested rejoin is not resolved by proximity or guessing.'
			);
		}
		if (!detourNodeIds.includes(node.id)) detourNodeIds.push(node.id);
	}
	for (const nodeId of detourNodeIds) if (!stopNodeIds.includes(nodeId)) stopNodeIds.push(nodeId);

	const experienceId = input.policy.entry?.experienceId ?? `experience:${components[0]?.nodeIds[0] ?? 'empty'}`;
	const entryNodeId = entryStopIdFromPolicy === null ? (components[0]?.nodeIds[0] ?? null) : entryStopIdFromPolicy.replace(/^stop:/, '');
	const entryStopId = entryNodeId === null ? null : stopIdOf(entryNodeId);

	// Guides: one per component. A residual cycle is re-based on the chosen entry
	// so its order is stable and its closing edge can be judged separately.
	const guides = components.map((component) => {
		let order = component.nodeIds;
		if (component.cycle && entryNodeId !== null && component.nodeIds.includes(entryNodeId)) {
			const at = component.nodeIds.indexOf(entryNodeId);
			order = [...component.nodeIds.slice(at), ...component.nodeIds.slice(0, at)];
		}
		return {
			id: `guide:${component.nodeIds[0]!}`,
			label: component.cycle ? 'Cycle' : (nodeById.get(component.nodeIds[0]!)?.label ?? 'Guide'),
			stopIds: order.map(stopIdOf),
			entryStopId: stopIdOf(order[0]!),
			order,
			cycle: component.cycle
		};
	});
	const entryGuide = guides.find((guide) => guide.stopIds.includes(entryStopId ?? '')) ?? guides[0] ?? null;
	if (guides.length > 0 && entryGuide === null) {
		return refuse(
			'policy-mismatch',
			'$.policy.entry',
			'the entry choice does not belong to any produced Guide',
			'Name an ordered occurrence of the source.'
		);
	}

	// Continuations and the closing edge of a cycle.
	//
	// The connections a guide consumes are the ones its **own** order steps
	// through — which is the re-based order when the entry sits mid-cycle, not the
	// component's head-first order. Collecting them from the component instead would
	// mark the real closing edge as already traversed and silently drop the loop for
	// every entry but the head. Judged against the traversal, a loop is encoded only
	// when a *second*, distinct connection closes it: a two-node pair's sole edge is
	// then never read as its own closing connection.
	const usedConnections = new Set<string>();
	for (const guide of guides) {
		for (const [position, nodeId] of guide.order.entries()) {
			const successor = guide.order[position + 1];
			if (successor === undefined) continue;
			// Connectivity is **undirected** in this codec: adjacency is mutual and a
			// duplicate undirected connection is refused, so one step consumes the one
			// connection between the pair whichever way it happens to be authored.
			const traversed =
				uniqueConnection(connections, nodeId, successor) ??
				uniqueConnection(connections, successor, nodeId);
			if (traversed !== null) usedConnections.add(traversed.id);
		}
	}
	const continuationOf = new Map<string, ExperienceContinuation>();
	for (const guide of guides) {
		for (const [index, nodeId] of guide.order.entries()) {
			const node = nodeById.get(nodeId)!;
			const successor = guide.order[index + 1];
			if (guide.cycle && successor === undefined) {
				const closing = connections.filter(
					(connection) =>
						connection.fromNodeId === nodeId &&
						connection.toNodeId === guide.order[0]! &&
						!usedConnections.has(connection.id)
				);
				continuationOf.set(
					nodeId,
					closing.length > 0 ? { kind: 'stop', stopId: stopIdOf(guide.order[0]!) } : { kind: 'end' }
				);
				continue;
			}
			if (node.nextNodeId === undefined) {
				continuationOf.set(nodeId, { kind: 'end' });
				continue;
			}
			if (successor !== undefined && node.nextNodeId === successor) {
				continuationOf.set(nodeId, { kind: 'sequence-next' });
				continue;
			}
			// An explicit override: a non-adjacent target, an End, or a loop whose
			// closing edge is not the next adjacent step.
			continuationOf.set(nodeId, { kind: 'stop', stopId: stopIdOf(node.nextNodeId) });
		}
	}

	// View-key holds and lock fields: authored values that need a reviewed
	// decision, because neither is a Stop hold until a reviewer says so.
	const retainedViewKeyHolds: Array<MigrationReport['retainedViewKeyHolds'][number]> = [];
	const holdsByStopNode = new Map<string, number>();
	for (const connection of connections) {
		for (const direction of ['forward', 'reverse'] as const) {
			const track = connection.viewTracks?.[direction] ?? [];
			const authored = track.reduce((total, keyframe) => total + Math.max(keyframe.holdSeconds ?? 0, 0), 0);
			if (authored <= 0) continue;
			const decision = input.policy.viewKeyHolds[`${connection.id}/${direction}`];
			if (decision === undefined) {
				return refuse(
					'requires-policy-mapping',
					`$.policy.viewKeyHolds["${connection.id}/${direction}"]`,
					`connection "${connection.id}" carries ${authored}s of authored ${direction} View-key holds and no mapping`,
					'Supply the identity-qualified Stop this hold belongs to; a hold is never silently dropped or turned into a second Camera timeline.'
				);
			}
			const targetNodeId = decision.stopId.replace(/^stop:/, '');
			if (!stopNodeIds.includes(targetNodeId)) {
				return refuse(
					'policy-mismatch',
					`$.policy.viewKeyHolds["${connection.id}/${direction}"].stopId`,
					`the mapping names "${decision.stopId}", which is not an occurrence of this source`,
					'Name one of the produced Stop ids.'
				);
			}
			if (holdsByStopNode.has(targetNodeId)) {
				return refuse(
					'policy-mismatch',
					`$.policy.viewKeyHolds["${connection.id}/${direction}"].stopId`,
					`"${decision.stopId}" already carries a mapped View-key hold`,
					'Map one direction onto one Stop; two holds on one Stop would merge two authored timings.'
				);
			}
			const authoredNodeHold = nodeById.get(targetNodeId)?.holdSeconds;
			if (authoredNodeHold !== undefined) {
				return refuse(
					'policy-mismatch',
					`$.policy.viewKeyHolds["${connection.id}/${direction}"].stopId`,
					`"${decision.stopId}" already carries an authored node hold of ${authoredNodeHold}s`,
					'A Stop has one local hold; map the View-key hold onto an occurrence that has no authored node hold, or decide the editorial timing explicitly.'
				);
			}
			holdsByStopNode.set(targetNodeId, decision.holdSeconds);
			retainedViewKeyHolds.push({
				connectionId: connection.id,
				direction,
				authoredHoldSeconds: authored,
				stopId: decision.stopId,
				mappedHoldSeconds: decision.holdSeconds
			});
		}
	}

	const lockInteraction: Array<MigrationReport['lockInteraction'][number]> = [];
	const gates: ExperienceGate[] = [];
	for (const node of nodes) {
		if (node.lockInteraction !== true) continue;
		const decision: LockInteractionDecision | undefined = input.policy.lockInteraction[node.id];
		if (decision === undefined) {
			return refuse(
				'requires-policy-mapping',
				`$.policy.lockInteraction["${node.id}"]`,
				`node "${node.id}" sets lockInteraction and carries no reviewed decision`,
				'Legacy direct-entry prohibition is not a Continue gate: supply either an explicit gate mapping with its reason, or a reviewed no-gate decision.'
			);
		}
		if (decision.kind === 'gate') {
			if (decision.presentationId !== presentationIdOf(node.id)) {
				return refuse(
					'policy-mismatch',
					`$.policy.lockInteraction["${node.id}"].presentationId`,
					`the gate mapping names "${decision.presentationId}" and the node's Presentation is "${presentationIdOf(node.id)}"`,
					'Map the gate onto the Presentation this node actually supplies.'
				);
			}
			gates.push({ id: `gate:${node.id}`, presentationId: decision.presentationId });
		}
		lockInteraction.push({ nodeId: node.id, decision: decision.kind });
	}

	// Experience
	const presentations: ExperiencePresentation[] = nodes.map((node) => ({
		id: presentationIdOf(node.id),
		label: node.label,
		viewId: viewIdOf(node.id)
	}));
	const stops: ExperienceStop[] = stopNodeIds.map((nodeId) => {
		const node = nodeById.get(nodeId)!;
		const hold = holdsByStopNode.get(nodeId) ?? node.holdSeconds;
		return {
			id: stopIdOf(nodeId),
			presentationId: presentationIdOf(nodeId),
			...(hold === undefined ? {} : { holdSeconds: hold }),
			continuation: continuationOf.get(nodeId) ?? { kind: 'end' }
		};
	});
	const detours: ExperienceDetour[] = [];
	const detourRows: Array<MigrationReport['detours'][number]> = [];
	for (const nodeId of detourNodeIds) {
		const decision = input.policy.detours[nodeId]!;
		for (const [field, stopId] of [
			['fromStopId', decision.fromStopId],
			['toStopId', decision.toStopId],
			['returnToStopId', decision.returnToStopId]
		] as const) {
			if (!stopNodeIds.includes(stopId.replace(/^stop:/, ''))) {
				return refuse(
					'policy-mismatch',
					`$.policy.detours["${nodeId}"].${field}`,
					`the detour mapping names "${stopId}", which is not an occurrence of this source`,
					'Name produced Stop ids for every side of the detour.'
				);
			}
		}
		detours.push({
			id: `detour:${nodeId}`,
			fromStopId: decision.fromStopId,
			toStopId: decision.toStopId,
			returnToStopId: decision.returnToStopId
		});
		detourRows.push({ nodeId, detourId: `detour:${nodeId}`, ...decision });
	}

	const experience: Experience = {
		id: experienceId,
		label: experienceId,
		entryGuideId: entryGuide?.id ?? null,
		presentations,
		stops,
		guides: guides.map((guide) => ({
			id: guide.id,
			label: guide.label,
			stopIds: guide.stopIds,
			entryStopId: guide.entryStopId
		})),
		gates,
		detours
	};

	// Typed resources: identities are preserved, bytes are pinned only when staged.
	const resources: TypedResource[] = project.scene.textures.map((texture) => {
		const staged = input.pins.find((pin) => pin.kind === 'texture' && pin.id === texture.id);
		if (staged !== undefined) {
			return {
				kind: 'texture',
				id: texture.id,
				contentRevision: staged.contentRevision,
				pin: staged.pin,
				unresolved: null
			};
		}
		return {
			kind: 'texture',
			id: texture.id,
			contentRevision: null,
			pin: null,
			unresolved: {
				reference: resourceReference(texture.id, baseline.sourceContentId),
				domain: 'resource:texture',
				status: 'repair-required',
				message: `texture "${texture.id}" has no staged external pin; its bytes are not admitted`
			}
		};
	});

	const scene: CameraFreeSceneDocument = {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: project.scene.textures,
		materials: project.scene.materials,
		entities: project.scene.entities,
		...(project.scene.clusters === undefined ? {} : { clusters: project.scene.clusters })
	};
	const camera = {
		formatVersion: CAMERA_UNIT_FORMAT_VERSION,
		views: nodes.map((node) => ({
			id: viewIdOf(node.id),
			label: node.label,
			eye: [...node.position] as [number, number, number],
			target: [...node.cameraTarget] as [number, number, number],
			fov: node.fov,
			connectedViewIds: [...node.connectedNodeIds]
		})),
		connections
	};
	const experiencePayload = { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [experience] };
	const resourcePayload = { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources };

	const unitIds: Record<UnitDomain, string> = {
		layout: `unit:layout:${project.id}`,
		scene: `unit:scene:${project.id}`,
		camera: `unit:camera:${project.id}`,
		experience: `unit:experience:${project.id}`,
		resources: `unit:resources:${project.id}`
	};

	const payloads: Record<UnitDomain, unknown> = {
		layout: project.layout,
		scene,
		camera,
		experience: experiencePayload,
		resources: resourcePayload
	};
	const entries: DependencyLockEntry[] = [];
	for (const domain of UNIT_DOMAINS) {
		if (domain === 'resources') continue;
		entries.push({
			domain: lockDomainFor(domain),
			subjectKind: 'unit',
			subjectId: unitIds[domain],
			instancePath: [],
			contentRevision: await computeUnitContentRevision(payloads[domain]),
			requiredCapabilities: [F2_REQUIREMENT],
			pin: null
		});
	}
	for (const resource of resources) {
		if (resource.pin === null) continue;
		entries.push({
			domain: resourceDomain(resource.kind),
			subjectKind: 'resource',
			subjectId: resource.id,
			instancePath: [],
			contentRevision: resource.contentRevision ?? resource.pin.hash,
			requiredCapabilities: [F2_REQUIREMENT],
			pin: resource.pin
		});
	}

	const envelope = await createProjectEnvelope({
		id: project.id,
		name: project.name,
		acceptedRevision: revision.value,
		dependencyLock: { formatVersion: 1, entries },
		layout: { unitId: unitIds.layout, data: project.layout },
		scene: { unitId: unitIds.scene, data: scene },
		camera: { unitId: unitIds.camera, data: camera },
		experience: { unitId: unitIds.experience, data: experiencePayload },
		resources: { unitId: unitIds.resources, data: resourcePayload }
	});

	const verified = validateProjectEnvelope(envelope);
	if (!verified.success) {
		const unsupported = verified.issues.some((issue) => issue.code.includes('unsupported'));
		return {
			kind: 'refused',
			refusals: verified.issues.map((issue) => ({
				code: (unsupported ? 'unsupported-unit' : 'invalid-source') as MigrationRefusalCode,
				path: issue.path,
				message: issue.message,
				action: 'Repair the authored source; conversion never clamps, repairs or drops an invalid anchor, timing or path.'
			}))
		};
	}

	return {
		kind: 'prepared',
		envelope,
		report: {
			baseline,
			unitIds,
			views: nodes.map((node) => ({
				nodeId: node.id,
				viewId: viewIdOf(node.id),
				presentationId: presentationIdOf(node.id),
				stopId: stopNodeIds.includes(node.id) ? stopIdOf(node.id) : null,
				guideId: guides.find((guide) => guide.order.includes(node.id))?.id ?? null,
				authoredHoldSeconds: node.holdSeconds ?? null
			})),
			guides: guides.map((guide) => ({
				guideId: guide.id,
				experienceId,
				entryStopId: guide.entryStopId,
				stopIds: guide.stopIds
			})),
			experiences: [{ experienceId, entryGuideId: experience.entryGuideId, entryStopId: entryStopId ?? '' }],
			connections: connections.map((connection) => ({
				connectionId: connection.id,
				fromViewId: connection.fromNodeId,
				toViewId: connection.toNodeId
			})),
			retainedViewKeyHolds,
			lockInteraction,
			detours: detourRows,
			unresolved: resources
				.filter((resource) => resource.unresolved !== null)
				.map((resource) => ({
					path: `$.units.resources.data.resources["${resource.id}"]`,
					resourceKind: resource.kind,
					resourceId: resource.id,
					message: resource.unresolved!.message
				})),
			requiredCapabilities: [F2_REQUIREMENT],
			notes: [
				'Single Camera/Experience conversion: Camera extraction, Experience order, Scene removal and locks are one candidate set.',
				`Prepared against source-content identity ${baseline.sourceContentId}; nothing is installed by this operation.`
			]
		}
	};
}
