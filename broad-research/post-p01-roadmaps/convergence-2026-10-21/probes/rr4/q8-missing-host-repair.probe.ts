/**
 * RR-4 Q8 — missing-host repair after cold load (disposable).
 *
 * One host Wall with two attached panels is deleted through the owner planner
 * (`planDeleteWall`) under each candidate policy; the project is JSON round
 * tripped and read by a fresh evaluator. Policies:
 *   (i)   deletion-time detach — joint Layout+Scene acceptance writes each dependent's
 *         evaluated pose as an ordinary world pose and removes the attachment;
 *   (ii)  keep — attachment becomes an AM-2-shaped UnresolvedBinding; Re-pick or explicit
 *         placement/delete required; Detach unavailable (no pose);
 *   (ii') keep + diagnostic — as (ii), the record also carries the last evaluated pose as
 *         diagnostic-only data (never rendered as authored pose);
 *   (iii) Detach later against the exact pre-delete Layout revision (F.1 `exact`);
 *   (v)   step-2 matrix: Layout-only delete, binding left dangling (derived status only).
 * A second case keeps the host present but makes one curved-host frame unavailable:
 * default detach refuses before producing a candidate; explicit keep/delete can proceed.
 * Scene shapes here are proposed probe JSON: Scene unit format 2 refuses an attachment (Q6).
 * Reusing AM-2's record needs a versioned Scene slot; other domains keep their own binding forms.
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planDeleteWall, planWallSegment, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { REFERENCES_VERSION, type SemanticReference } from '@portfolio/project-model';
import { createEmptyUnitEnvelope, validateUnresolvedBinding, type UnresolvedBinding } from '@portfolio/project-model/units';
import { resolveUnitReference } from '@portfolio/project-model/references/unit-resolution';
import { arcLength, curvedWall, emptyDoc, evaluate, residual, type Binding, type Pose } from './rr4-support';

const log = (label: string, value: unknown) => console.log(`RR4 Q8 ${label} ${JSON.stringify(value)}`);

type Entity =
	| { id: string; kind: 'independent'; pose: Pose }
	| { id: string; kind: 'attached'; binding: Binding; host: SemanticReference }
	| { id: string; kind: 'unresolved'; parameters: Omit<Binding, 'hostWallId'>; unresolved: UnresolvedBinding; diagnosticLastPose?: Pose };
type ProbeProject = { layout: LayoutDocumentWallFirst; scene: Entity[] };
type DeletePolicy = 'detach' | 'keep-unresolved' | 'delete-dependents';

/** Probe candidate preparation only: it does not admit the proposed Scene format through live F.4. */
function prepareHostDeletion(before: ProbeProject, wallId: string, policy: DeletePolicy):
	| { kind: 'refused'; code: 'dependent-pose-unavailable'; entityIds: string[] }
	| { kind: 'prepared'; candidate: ProbeProject } {
	const poses = new Map<string, Pose>();
	const unavailable: string[] = [];
	for (const entity of before.scene) {
		if (entity.kind !== 'attached' || entity.binding.hostWallId !== wallId) continue;
		const pose = evaluate(before.layout, entity.binding);
		if (pose) poses.set(entity.id, pose); else unavailable.push(entity.id);
	}
	// Evaluate every dependent before preparing either unit; never install a partial detach.
	if (policy === 'detach' && unavailable.length) return { kind: 'refused', code: 'dependent-pose-unavailable', entityIds: unavailable };
	const layout = must(planDeleteWall(before.layout, wallId)).document;
	const scene = before.scene.flatMap((entity): Entity[] => {
		if (entity.kind !== 'attached' || entity.binding.hostWallId !== wallId) return [entity];
		if (policy === 'delete-dependents') return [];
		if (policy === 'detach') return [{ id: entity.id, kind: 'independent', pose: poses.get(entity.id)! }];
		const { hostWallId: _host, ...parameters } = entity.binding;
		return [{
			id: entity.id,
			kind: 'unresolved',
			parameters,
			unresolved: { reference: entity.host, domain: 'scene', status: 'removed', message: `host wall ${wallId} deleted at the accepted revision` }
		}];
	});
	return { kind: 'prepared', candidate: { layout, scene } };
}

function must<T extends { kind: string }>(plan: T): Extract<T, { kind: 'success' }> {
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
	return plan as Extract<T, { kind: 'success' }>;
}

async function layoutRevision(layout: LayoutDocumentWallFirst) {
	const envelope = await createEmptyUnitEnvelope({ id: 'rr4', name: 'RR4', acceptedRevision: { projectId: 'rr4', revisionId: 'r1' }, layout });
	return { envelope, revision: envelope.units.layout.header.contentRevision };
}

function wallRef(layout: LayoutDocumentWallFirst, wallId: string, contentRevision: string): SemanticReference {
	return {
		version: REFERENCES_VERSION,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'wall', id: wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: layout.floor.id, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
}

/** Fresh cold reader: what can be rendered and which repairs are available, from persisted JSON only. */
function coldRead(project: ProbeProject) {
	return project.scene.map((entity) => {
		if (entity.kind === 'independent') return { id: entity.id, renders: 'authored-pose', repairs: [] as string[] };
		if (entity.kind === 'attached') {
			const pose = evaluate(project.layout, entity.binding);
			return pose
				? { id: entity.id, renders: 'evaluated-pose', repairs: ['detach'] }
				: { id: entity.id, renders: 'nothing (pose unavailable, derived)', repairs: ['re-pick', 'place-explicitly', 'delete'] };
		}
		return {
			id: entity.id,
			renders: entity.diagnosticLastPose ? 'nothing; editor ghost from diagnostic only' : 'nothing',
			repairs: ['re-pick', 'place-explicitly', 'delete', ...(entity.diagnosticLastPose ? ['detach-at-last-known-pose'] : [])]
		};
	});
}

describe('RR-4 Q8 missing-host repair after cold load', () => {
	it('compares deletion-time detach, kept UnresolvedBinding (± diagnostic pose), exact-revision Detach and dangling binding', async () => {
		const planned = must(planWallSegment({ baseline: createEmptyWallFirstLayoutDocument(), start: [0, 0], end: [8, 0], role: 'boundary' }));
		const before = planned.document;
		const wallId = planned.createdWallIds[0]!;
		const { revision: beforeRevision } = await layoutRevision(before);
		const bindings: Binding[] = [
			{ id: 'e1', hostWallId: wallId, s: 2, side: 'left', width: 0.6, standoff: 0.02 },
			{ id: 'e2', hostWallId: wallId, s: 6, side: 'right', width: 0.6, standoff: 0.02 }
		];
		const host = wallRef(before, wallId, beforeRevision);
		const evaluatedBefore = bindings.map((binding) => evaluate(before, binding)!);
		const sceneBefore: Entity[] = bindings.map((binding) => ({ id: binding.id, kind: 'attached', binding, host }));
		const after = must(planDeleteWall(before, wallId)).document;
		const { envelope: afterEnvelope } = await layoutRevision(after);
		const detached = prepareHostDeletion({ layout: before, scene: sceneBefore }, wallId, 'detach');
		const kept = prepareHostDeletion({ layout: before, scene: sceneBefore }, wallId, 'keep-unresolved');
		if (detached.kind !== 'prepared' || kept.kind !== 'prepared') throw new Error('healthy-host policies must prepare');

		const unresolved = (binding: Binding, withPose: boolean): Entity => {
			const { hostWallId: _host, ...parameters } = binding;
			return {
				id: binding.id,
				kind: 'unresolved',
				parameters,
				unresolved: { reference: host, domain: 'scene', status: 'removed', message: `host wall ${wallId} deleted at the accepted revision` },
				...(withPose ? { diagnosticLastPose: evaluate(before, binding)! } : {})
			};
		};
		const policies: Record<string, Entity[]> = {
			'i-detach-at-delete': detached.candidate.scene,
			'ii-keep-unresolved': kept.candidate.scene,
			"ii'-keep-with-diagnostic-pose": bindings.map((binding) => unresolved(binding, true)),
			'v-layout-only-dangling': sceneBefore
		};
		const rows: Record<string, unknown> = {};
		for (const [name, scene] of Object.entries(policies)) {
			const cold = JSON.parse(JSON.stringify({ layout: after, scene })) as { layout: LayoutDocumentWallFirst; scene: Entity[] };
			const read = coldRead(cold);
			// Pose recoverable cold (authored or via an explicit repair) and equal to the last evaluated pose?
			const recoverable = cold.scene.map((entity, index) => {
				const pose = entity.kind === 'independent' ? entity.pose : entity.kind === 'unresolved' ? entity.diagnosticLastPose : evaluate(cold.layout, entity.binding) ?? undefined;
				return pose ? residual(pose, evaluatedBefore[index]!).position : null;
			});
			rows[name] = { read, poseRecoverableResidual: recoverable, sceneBytes: JSON.stringify(scene).length, authoredPoseFields: cold.scene.filter((e) => e.kind === 'independent').length };
		}
		// (iii) Detach evaluated against the exact pre-delete revision, cold: the old Layout content is not in the project.
		const exactOld = await resolveUnitReference(host, { envelope: afterEnvelope, sessionEpoch: 'rr4-cold' });
		rows['iii-exact-revision-detach'] = { resolution: exactOld.kind, code: exactOld.kind === 'failed' ? exactOld.code : null, repairs: exactOld.kind === 'failed' ? exactOld.repairs : null };
		// Undo of the delete is a snapshot restore under every policy: the binding re-resolves.
		const undone = JSON.parse(JSON.stringify({ layout: before, scene: sceneBefore })) as { layout: LayoutDocumentWallFirst; scene: Entity[] };
		rows.undo = coldRead(undone);
		log('policies', rows);

		const ri = rows['i-detach-at-delete'] as { poseRecoverableResidual: (number | null)[] };
		const rii = rows['ii-keep-unresolved'] as { poseRecoverableResidual: (number | null)[] };
		const riip = rows["ii'-keep-with-diagnostic-pose"] as { poseRecoverableResidual: (number | null)[] };
		const rv = rows['v-layout-only-dangling'] as { poseRecoverableResidual: (number | null)[] };
		expect(ri.poseRecoverableResidual).toEqual([0, 0]);
		expect(rii.poseRecoverableResidual).toEqual([null, null]);
		expect(riip.poseRecoverableResidual).toEqual([0, 0]);
		expect(rv.poseRecoverableResidual).toEqual([null, null]);
		expect(exactOld.kind).toBe('failed');
	});

	it('refuses default detach atomically when a present curved host cannot evaluate a dependent pose', async () => {
		const points: Record<string, [number, number]> = { A: [0, 0], B: [4, 0] };
		const before = emptyDoc(points, [curvedWall('W', 'A', 'B', points, [[2, 0.5]])]);
		const { revision } = await layoutRevision(before);
		const host = wallRef(before, 'W', revision);
		const bindings: Binding[] = [
			{ id: 'e1', hostWallId: 'W', s: 1, side: 'left', width: 0.6, standoff: 0.02 },
			{ id: 'e2', hostWallId: 'W', s: 6, side: 'right', width: 0.6, standoff: 0.02 }
		];
		const project: ProbeProject = { layout: before, scene: bindings.map((binding) => ({ id: binding.id, kind: 'attached', binding, host })) };
		const previousJson = JSON.stringify(project);
		expect(before.walls.some((wall) => wall.id === 'W')).toBe(true);
		expect(arcLength(before, 'W')).toBeLessThan(bindings[1]!.s);
		expect(evaluate(before, bindings[0]!)).not.toBeNull();
		expect(evaluate(before, bindings[1]!)).toBeNull();

		const detach = prepareHostDeletion(project, 'W', 'detach');
		expect(detach).toEqual({ kind: 'refused', code: 'dependent-pose-unavailable', entityIds: ['e2'] });
		expect(JSON.stringify(project)).toBe(previousJson);

		const keep = prepareHostDeletion(project, 'W', 'keep-unresolved');
		const remove = prepareHostDeletion(project, 'W', 'delete-dependents');
		if (keep.kind !== 'prepared' || remove.kind !== 'prepared') throw new Error('explicit alternatives must prepare');
		const keptCold = JSON.parse(JSON.stringify(keep.candidate)) as ProbeProject;
		const removedCold = JSON.parse(JSON.stringify(remove.candidate)) as ProbeProject;
		expect(keptCold.layout.walls).toEqual([]);
		expect(removedCold.layout.walls).toEqual([]);
		expect(removedCold.scene).toEqual([]);
		for (const entity of keptCold.scene) {
			expect(entity.kind).toBe('unresolved');
			if (entity.kind === 'unresolved') expect(validateUnresolvedBinding(entity.unresolved).success).toBe(true);
		}
		expect(coldRead(keptCold).every((entity) => entity.renders === 'nothing' && !entity.repairs.includes('detach'))).toBe(true);
		expect(JSON.stringify(project)).toBe(previousJson);
		log('unavailable-before-delete', { hostPresent: true, hostLength: arcLength(before, 'W'), detach, previousJsonPreserved: true, keep: coldRead(keptCold), delete: coldRead(removedCold) });
	});
});
