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
 * Scene shapes here are probe JSON: Scene unit format 2 refuses an attachment (Q6).
 */
import { describe, expect, it } from 'vitest';
import { createEmptyWallFirstLayoutDocument, planDeleteWall, planWallSegment, type LayoutDocumentWallFirst } from '@portfolio/layout-core';
import { REFERENCES_VERSION, type SemanticReference } from '@portfolio/project-model';
import { createEmptyUnitEnvelope } from '@portfolio/project-model/units';
import { resolveUnitReference } from '@portfolio/project-model/references/unit-resolution';
import { evaluate, residual, type Binding, type Pose } from './rr4-support';

const log = (label: string, value: unknown) => console.log(`RR4 Q8 ${label} ${JSON.stringify(value)}`);

type UnresolvedBinding = { reference: SemanticReference; domain: 'scene'; status: 'missing' | 'removed'; message: string };
type Entity =
	| { id: string; kind: 'independent'; pose: Pose }
	| { id: string; kind: 'attached'; binding: Binding; host: SemanticReference }
	| { id: string; kind: 'unresolved'; parameters: Omit<Binding, 'hostWallId'>; unresolved: UnresolvedBinding; diagnosticLastPose?: Pose };

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
function coldRead(project: { layout: LayoutDocumentWallFirst; scene: Entity[] }) {
	return project.scene.map((entity) => {
		if (entity.kind === 'independent') return { id: entity.id, renders: 'authored-pose', repairs: [] as string[] };
		if (entity.kind === 'attached') {
			const pose = evaluate(project.layout, entity.binding);
			return pose
				? { id: entity.id, renders: 'evaluated-pose', repairs: ['detach'] }
				: { id: entity.id, renders: 'nothing (host-missing, derived)', repairs: ['re-pick', 'place-explicitly', 'delete'] };
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
			'i-detach-at-delete': bindings.map((binding) => ({ id: binding.id, kind: 'independent', pose: evaluate(before, binding)! })),
			'ii-keep-unresolved': bindings.map((binding) => unresolved(binding, false)),
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
});
