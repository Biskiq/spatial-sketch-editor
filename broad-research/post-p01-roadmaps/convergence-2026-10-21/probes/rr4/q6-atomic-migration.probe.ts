/**
 * RR-4 Q6 — atomic Layout + Scene migration through the LIVE F.4 unit host shape
 * (disposable). Same coordinator, registry, preparation and adapter the Stage
 * host builds (`createStageAcceptanceHost`: unit registry + adapter `compound:
 * true`). Probe planners are registered only into this in-memory coordinator.
 *
 * Imports the editor coordinator by relative path (editor-internal module).
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planDissolveJunction,
	planRigidWallMove,
	planWallSegment,
	planWallSplit,
	type LayoutDocumentWallFirst,
	type NodingIdAllocator
} from '@portfolio/layout-core';
import type { AuthoringIntent, DomainPlanner, PlannerOutcome, PlannerRequest } from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createProjectEnvelope,
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	replaceUnitData,
	serializeProjectEnvelope,
	type CameraFreeSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '../../../../../apps/editor/src/lib/authoring/f4/acceptance-coordinator';

const log = (label: string, value: unknown) => console.log(`RR4 Q6 ${label} ${JSON.stringify(value)}`);

type Envelope = ProjectEnvelope;

function panel(id: string, x: number, z: number) {
	return {
		kind: 'primitive' as const,
		primitive: 'plane' as const,
		id,
		name: id,
		dimensions: { width: 0.6, height: 0.8 },
		materialId: 'plaster-warm',
		castShadow: false,
		receiveShadow: true,
		position: [x, 1.5, z] as [number, number, number],
		rotation: [0, 0, 0] as [number, number, number]
	};
}

async function baseline(): Promise<{ envelope: Envelope; wallId: string }> {
	const planned = planWallSegment({ baseline: createEmptyWallFirstLayoutDocument(), start: [0, 0], end: [8, 0], role: 'boundary' });
	if (planned.kind !== 'success') throw new Error('fixture');
	const scene: CameraFreeSceneDocument = {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [panel('entity-p1', 1, 0.12), panel('entity-p6', 6, 0.12)]
	} as unknown as CameraFreeSceneDocument;
	const envelope = await createProjectEnvelope({
		id: 'rr4',
		name: 'RR4',
		acceptedRevision: { projectId: 'rr4', revisionId: 'r0' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'rr4:layout', data: planned.document },
		scene: { unitId: 'rr4:scene', data: scene },
		camera: { unitId: 'rr4:camera', data: createEmptyCameraPayload() },
		experience: { unitId: 'rr4:experience', data: createEmptyExperiencePayload() },
		resources: { unitId: 'rr4:resources', data: createEmptyResourcePayload() }
	});
	return { envelope, wallId: planned.createdWallIds[0]! };
}

function candidate(request: PlannerRequest<Envelope>, layout: LayoutDocumentWallFirst, scene?: CameraFreeSceneDocument): PlannerOutcome<Envelope> {
	let next = replaceUnitData(request.snapshot.domain.source, 'layout', layout);
	if (scene) next = replaceUnitData(next, 'scene', scene);
	return {
		kind: 'prepared',
		candidate: {
			operationId: request.intent.operationId,
			sourceKind: 'unit-envelope',
			sourceVersion: 1,
			source: next,
			changes: [{ kind: 'probe', subjectIds: [], fields: [] }],
			correspondence: [],
			diagnostics: []
		}
	};
}

const refuse = (code: string): PlannerOutcome<Envelope> => ({ kind: 'rejected', code, message: code, diagnostics: [] });

/** C-pose: move a Wall and rebase its declared followers' world poses in one candidate. */
const moveWithRebase: DomainPlanner<Envelope> = {
	id: 'rr4.move-with-rebase',
	kind: 'rr4.move-with-rebase',
	admission: { domain: 'layout', compound: true, units: true, resources: false },
	sourceKinds: ['unit-envelope'],
	sourceVersions: [1],
	prepare(request) {
		const payload = request.intent.payload as { wallId: string; delta: [number, number]; followers: string[]; corruptScene?: boolean; throwAfterLayout?: boolean };
		const source = request.snapshot.domain.source;
		const plan = planRigidWallMove(source.units.layout.data, payload.wallId, payload.delta);
		if (plan.kind !== 'success') return refuse(plan.kind);
		if (payload.throwAfterLayout) throw new Error('planner failed after preparing Layout');
		const scene = JSON.parse(JSON.stringify(source.units.scene.data)) as CameraFreeSceneDocument & { entities: Array<{ id: string; position: number[] }> };
		for (const entity of scene.entities) {
			if (!payload.followers.includes(entity.id)) continue;
			entity.position = [entity.position[0]! + payload.delta[0], entity.position[1]!, entity.position[2]! + payload.delta[1]];
		}
		if (payload.corruptScene) (scene.entities[0] as Record<string, unknown>).position = [Number.NaN, 0, 0];
		return candidate(request, plan.document, scene);
	}
};

/** B-mig persisted: tries to store an evaluated binding on the Scene entity. */
const splitWithBinding: DomainPlanner<Envelope> = {
	id: 'rr4.split-with-binding',
	kind: 'rr4.split-with-binding',
	admission: { domain: 'layout', compound: true, units: true, resources: false },
	sourceKinds: ['unit-envelope'],
	sourceVersions: [1],
	prepare(request) {
		const payload = request.intent.payload as { wallId: string; d: number };
		const source = request.snapshot.domain.source;
		const plan = planWallSplit(source.units.layout.data, payload.wallId, payload.d, capturedAllocator(request.intent));
		if (plan.kind !== 'success') return refuse(plan.kind);
		const scene = JSON.parse(JSON.stringify(source.units.scene.data));
		scene.entities[1].attachment = { host: { domain: 'layout', kind: 'wall', id: plan.createdWallIds[0] }, s: 2, side: 'left' };
		return candidate(request, plan.document, scene);
	}
};

/** Layout-only split/dissolve with CAPTURED ids (F.4: a planner never allocates). */
function capturedAllocator(intent: AuthoringIntent): NodingIdAllocator {
	const take = (kind: string) => {
		const found = intent.allocatedIds.find((entry) => entry.kind === kind);
		if (!found) throw new Error(`no captured ${kind}`);
		return found.id;
	};
	return { nextWallId: () => take('layout-wall'), nextJunctionId: () => take('layout-junction') };
}
const splitOnly: DomainPlanner<Envelope> = {
	id: 'rr4.split',
	kind: 'rr4.split',
	admission: { domain: 'layout', compound: false, units: true, resources: false },
	sourceKinds: ['unit-envelope'],
	sourceVersions: [1],
	prepare(request) {
		const payload = request.intent.payload as { wallId: string; d: number };
		const plan = planWallSplit(request.snapshot.domain.source.units.layout.data, payload.wallId, payload.d, capturedAllocator(request.intent));
		return plan.kind === 'success' ? candidate(request, plan.document) : refuse(plan.rejection.code);
	}
};
const dissolveOnly: DomainPlanner<Envelope> = {
	id: 'rr4.dissolve',
	kind: 'rr4.dissolve',
	admission: { domain: 'layout', compound: false, units: true, resources: false },
	sourceKinds: ['unit-envelope'],
	sourceVersions: [1],
	prepare(request) {
		const payload = request.intent.payload as { junctionId: string };
		const plan = planDissolveJunction(request.snapshot.domain.source.units.layout.data, payload.junctionId);
		return plan.kind === 'success' ? candidate(request, plan.document) : refuse(plan.rejection.code);
	}
};

/** Declares single-domain Scene (the landed Scene admission) yet also edits Layout. */
const sceneOverreach: DomainPlanner<Envelope> = {
	id: 'rr4.scene-overreach',
	kind: 'rr4.scene-overreach',
	admission: { domain: 'scene', compound: false, units: false, resources: false },
	sourceKinds: ['unit-envelope'],
	sourceVersions: [1],
	prepare(request) {
		const payload = request.intent.payload as { wallId: string };
		const plan = planRigidWallMove(request.snapshot.domain.source.units.layout.data, payload.wallId, [0, 0.5]);
		if (plan.kind !== 'success') return refuse(plan.kind);
		const scene = JSON.parse(JSON.stringify(request.snapshot.domain.source.units.scene.data));
		scene.entities[0].position[1] = 1.6;
		return candidate(request, plan.document, scene);
	}
};

async function boot() {
	const { envelope, wallId } = await baseline();
	let ordinal = 0;
	const coordinator = createAcceptanceCoordinator<Envelope>({
		adapter: createUnitAcceptanceAdapter({ compound: true }),
		preparation: createUnitAcceptancePreparation({ registry: createUnitPlannerRegistry<Envelope>(), sessionEpoch: 'rr4' }),
		sessionEpoch: 'rr4',
		baseline: { revision: envelope.acceptedRevision, source: envelope, canonicalJson: serializeProjectEnvelope(envelope), sourceContentId: await computeEnvelopeSourceContentId(envelope), blockingIssues: [] },
		planners: [moveWithRebase, splitWithBinding, splitOnly, dissolveOnly, sceneOverreach],
		mintRevisionId: () => `rev-${++ordinal}`
	});
	return { coordinator, wallId };
}

function intent(coordinator: { acceptedRevision(): { projectId: string; revisionId: string } }, kind: string, payload: Record<string, unknown>, allocatedIds: { kind: string; id: string }[] = [], expected?: { projectId: string; revisionId: string }): AuthoringIntent {
	return { version: 1, kind, operationId: `${kind}-${Math.random().toString(36).slice(2, 8)}`, expectedRevision: expected ?? coordinator.acceptedRevision(), targets: [], payload: payload as never, capturedInputs: [], allocatedIds };
}

describe('RR-4 Q6 atomic migration and history', () => {
	it('registration: every probe planner is admitted by the live unit profile', async () => {
		const { coordinator } = await boot();
		log('registration', { planners: coordinator.planners().map((p) => p.kind), refusals: coordinator.registrationRefusals() });
		expect(coordinator.registrationRefusals()).toEqual([]);
	});

	it('injections refuse with no state change; success installs once; Undo/Redo exact with fresh revisions', async () => {
		const { coordinator, wallId } = await boot();
		const json0 = coordinator.current().canonicalJson;
		const depth0 = coordinator.history().depth;
		const moveIntent = (extra: Record<string, unknown> = {}, expected?: { projectId: string; revisionId: string }) =>
			intent(coordinator, 'rr4.move-with-rebase', { wallId, delta: [0, 1], followers: ['entity-p1', 'entity-p6'], ...extra }, [], expected);

		const stale = await coordinator.accept(moveIntent({}, { projectId: 'rr4', revisionId: 'not-current' }));
		const thrown = await coordinator.accept(moveIntent({ throwAfterLayout: true }));
		const corrupt = await coordinator.accept(moveIntent({ corruptScene: true }));
		const binding = await coordinator.accept(intent(coordinator, 'rr4.split-with-binding', { wallId, d: 4 }, [{ kind: 'layout-wall', id: 'wall-x1' }, { kind: 'layout-junction', id: 'junction-x1' }]));
		const missingTarget = await coordinator.accept({
			...moveIntent(),
			targets: [{ version: 1, domain: 'layout', revision: { kind: 'exact', contentRevision: coordinator.current().source.units.layout.header.contentRevision }, subject: { kind: 'wall', id: 'wall-missing' }, instancePath: [], location: { kind: 'layout-location', levelId: coordinator.current().source.units.layout.data.floor.id, structureInstancePath: [] }, componentId: null, capabilityId: null }]
		});
		const refusals = [stale, thrown, corrupt, binding, missingTarget].map((result) =>
			result.kind === 'rejected' ? { code: result.code, reason: result.reason, firstIssue: result.diagnostics[0]?.path ?? null } : { kind: result.kind }
		);
		log('refusals', refusals);
		expect(refusals.every((entry) => 'code' in entry)).toBe(true);
		expect(coordinator.current().canonicalJson).toBe(json0);
		expect(coordinator.history().depth).toBe(depth0);

		const r0 = coordinator.acceptedRevision();
		const accepted = await coordinator.accept(moveIntent());
		expect(accepted.kind).toBe('accepted');
		const json1 = coordinator.current().canonicalJson;
		const after = coordinator.current().source;
		const positions = (after.units.scene.data as unknown as { entities: Array<{ id: string; position: number[] }> }).entities.map((e) => [e.id, e.position]);
		const changedUnits = (['layout', 'scene', 'camera', 'experience', 'resources'] as const).filter(
			(domain) => JSON.parse(json0).units[domain].header.contentRevision !== JSON.parse(json1).units[domain].header.contentRevision
		);

		// Topology: split then many-to-one dissolve, both with captured ids.
		const split = await coordinator.accept(intent(coordinator, 'rr4.split', { wallId, d: 4 }, [{ kind: 'layout-wall', id: 'wall-x1' }, { kind: 'layout-junction', id: 'junction-x1' }]));
		const json2 = coordinator.current().canonicalJson;
		const dissolve = await coordinator.accept(intent(coordinator, 'rr4.dissolve', { junctionId: 'junction-x1' }));
		const json3 = coordinator.current().canonicalJson;
		const seen = new Set([r0.revisionId, ...[accepted, split, dissolve].map((r) => (r.kind === 'accepted' ? r.afterRevision.revisionId : 'x'))]);
		const u1 = await coordinator.undo();
		const back2 = coordinator.current().canonicalJson === json2;
		const u2 = await coordinator.undo();
		const back1 = coordinator.current().canonicalJson === json1;
		const u3 = await coordinator.undo();
		const back0 = coordinator.current().canonicalJson === json0;
		const redo = await coordinator.redo();
		const redoRevision = redo.kind === 'restored' ? redo.afterRevision.revisionId : null;
		const row = {
			acceptedChangedUnits: changedUnits,
			positionsAfterMove: positions,
			splitKind: split.kind,
			dissolveKind: dissolve.kind,
			dissolveRestoresOriginalLayout: JSON.stringify(JSON.parse(json3).units.layout.data) === JSON.stringify(JSON.parse(json1).units.layout.data),
			undo: [u1.kind, u2.kind, u3.kind],
			exactRestores: { back2, back1, back0 },
			redoFreshRevision: redoRevision !== null && !seen.has(redoRevision),
			redoMatchesJson1: coordinator.current().canonicalJson === json1
		};
		log('history', row);
		expect(changedUnits).toEqual(['layout', 'scene']);
		expect(back2 && back1 && back0).toBe(true);
		expect(row.redoFreshRevision).toBe(true);
	});

	it('undeclared compound: a planner declaring single-domain Scene also changes Layout', async () => {
		const { coordinator, wallId } = await boot();
		const untargeted = await coordinator.accept(intent(coordinator, 'rr4.scene-overreach', { wallId }));
		const sceneTarget = { version: 1 as const, domain: 'scene' as const, revision: { kind: 'exact' as const, contentRevision: coordinator.current().source.units.scene.header.contentRevision }, subject: { kind: 'entity', id: 'entity-p1' }, instancePath: [], location: { kind: 'project-root' as const }, componentId: null, capabilityId: null };
		const targeted = await coordinator.accept({ ...intent(coordinator, 'rr4.scene-overreach', { wallId }), targets: [sceneTarget] });
		const summary = (result: typeof untargeted) => ({ kind: result.kind, code: result.kind === 'rejected' ? result.code : null, reason: result.kind === 'rejected' ? result.reason : null, message: result.kind === 'rejected' ? result.message : null });
		const result = targeted;
		log('undeclared-compound', { untargeted: summary(untargeted), sceneTargeted: summary(targeted) });
		// Recorded, not asserted as desired behaviour: the scope check passes only the planner's domain.
		expect(['accepted', 'rejected']).toContain(result.kind);
	});
});
