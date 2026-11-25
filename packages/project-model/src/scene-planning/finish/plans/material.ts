/** Renaming and removal of project Finishes. */

import { type Result, type FinishPlanContext } from '../context';
import { finishIdIsReferenced, finishUsersWithLifecycle } from '../inspect';
import { materialBaseOf } from '../model';
import { FINISH_NAME_MAX_LENGTH } from '../payload';
import { refuse } from '../shared';
import { type CameraFreeSceneDocument as SceneDocument, type TypedResource } from '../../../units/types';

export function planSceneFinishRename(context: FinishPlanContext): Result {
	const { request, before, reader, complete, materialGrant, readProjectFinish, isResult } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['finish', 'name']);
		if (payload === null) return refuse(reader.issues[0]?.message ?? 'Rename needs a Finish and a name.');
		const instance = readProjectFinish(payload.finish);
		if (isResult(instance)) return instance;
		// A blank name is a naming refusal, not a shape error: read the raw string.
		const rawName = typeof payload.name === 'string' ? payload.name : null;
		if (rawName === null || reader.issues.length > 0) return refuse(reader.issues[0]?.message ?? 'Name the Finish.');
		if (request.intent.targets.length !== 0) return refuse('Renaming a Finish addresses no object.', 'invalid-target');
		if (request.allocatedIds.length !== 0) return refuse('Renaming a Finish creates no id.', 'unexpected-allocation');
		const name = rawName.trim();
		if (name.length === 0 || name.length > FINISH_NAME_MAX_LENGTH) {
			return refuse(`A Finish name must be 1-${FINISH_NAME_MAX_LENGTH} characters.`, 'invalid-name');
		}
		if (name === instance.name) return refuse('That Finish already has this name.', 'no-change');
		const after: SceneDocument = {
			...before,
			materials: before.materials.map((candidate) => (candidate.id === instance.id ? { ...candidate, name } : candidate))
		};
		return complete(after, { materials: materialGrant({ changed: [instance.id] }) }, [instance.id], ['materials']);
}

export function planSceneFinishRemove(context: FinishPlanContext): Result {
	const { request, envelope, before, reader, materialGrant, withResources, readProjectFinish, isResult } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['finish']);
		if (payload === null) return refuse(reader.issues[0]?.message ?? 'Removal needs one Finish.');
		const instance = readProjectFinish(payload.finish);
		if (isResult(instance)) return instance;
		if (request.intent.targets.length !== 0) return refuse('Removing a Finish addresses no object.', 'invalid-target');
		if (request.allocatedIds.length !== 0) return refuse('Removing a Finish creates no id.', 'unexpected-allocation');
		if (finishIdIsReferenced(before, instance.id)) {
			const { users, storedReferences } = finishUsersWithLifecycle(
				before,
				`project:${instance.id}`,
				envelope.units.layout.data
			);
			const dormant = users.filter((user) => user.kind === 'surface' && user.lifecycle === 'dormant').length;
			return {
				kind: 'rejected',
				code: 'finish-in-use',
				message:
					`That Finish is still used by ${users.length} target${users.length === 1 ? '' : 's'}` +
					`${dormant > 0 ? ` (${dormant} dormant)` : ''}` +
					`${storedReferences.length > 0 ? ` and ${storedReferences.length} stored reference${storedReferences.length === 1 ? '' : 's'}` : ''}. ` +
					'Assign another Finish first.',
				diagnostics: [...users, ...storedReferences].map((user) => ({
					path: '$.payload.finish',
					code: user.kind === 'surface' && user.lifecycle !== 'present' ? `${user.lifecycle}-user` : 'user',
					message: user.key
				}))
			};
		}
		const materials = before.materials.filter((candidate) => candidate.id !== instance.id);
		const hash = materialBaseOf(instance);
		let resources: TypedResource[] | null = null;
		let lockEntries: import('../../../units/types').DependencyLockEntry[] | null = null;
		// The definition and its lock leave with their last Finish. Texture rows
		// and P20 bytes stay: they are independently retained project images.
		if (hash !== null && !materials.some((candidate) => materialBaseOf(candidate) === hash)) {
			resources = envelope.units.resources.data.resources.filter(
				(resource) => !(resource.kind === 'material' && resource.id === hash)
			);
			lockEntries = envelope.dependencyLock.entries.filter(
				(entry) => !(entry.domain === 'resource:material' && entry.subjectId === hash)
			);
		}
		return withResources(
			{ ...before, materials },
			{ materials: materialGrant({ removed: [instance.id] }) },
			resources,
			lockEntries,
			[instance.id],
			resources === null ? ['materials'] : ['materials', 'resources', 'dependencyLock']
		);
}

