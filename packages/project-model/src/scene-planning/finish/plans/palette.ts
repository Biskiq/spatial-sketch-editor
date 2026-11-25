/** World palette slots and adoption. */

import { type SceneEntity, type ScenePaletteSlot } from '../../../scene';
import { type Result, type FinishPlanContext } from '../context';
import { planEdit } from '../edit-plan';
import { finishOf, isPristineInstance, literalizePaletteFollowers, materialInstanceById, nextPaletteName, paletteFollowers, paletteHasRoom, PALETTE_NAME_MAX_LENGTH } from '../model';
import { readColor, readAdoptionMapping } from '../payload';
import { materialRecipesOf, refuse, nameContextOf } from '../shared';
import { generatedFinishName, isGeneratedFinishName, uniqueFinishName } from '../treatment';
import { sceneEntityTargetProblem } from '../../intent-payload';
import { planPaletteAdoption } from '../../palette-adoption';
import { type SceneRecordScope } from '../../record-scope';
import { type CameraFreeSceneDocument as SceneDocument } from '../../../units/types';

export function planScenePaletteSlotAdd(context: FinishPlanContext): Result {
	const { request, options, envelope, before, header, reader, complete, materialGrant } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['color', 'adoptEntityId', 'reach', 'mode']);
		const parsedColor = payload === null ? null : readColor(reader, payload.color, '$.payload.color');
		const adoptEntityId =
			payload === null || payload.adoptEntityId === undefined
				? null
				: reader.opaqueId(payload.adoptEntityId, '$.payload.adoptEntityId');
		const reach = payload === null || payload.reach === undefined ? null : reader.integerAtLeast(payload.reach, '$.payload.reach', 1);
		const mode = payload === null || payload.mode === undefined ? null : reader.tag(payload.mode, '$.payload.mode', ['just-this', 'all', 'in-place']);
		if (payload === null || parsedColor === null || !parsedColor.ok || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A palette colour is required.');
		}
		if (!paletteHasRoom(before.palette)) return refuse('The palette already holds eight colours.', 'palette-full');
		const adopt = adoptEntityId !== null;
		if (adopt !== (reach !== null && mode !== null)) {
			return refuse('Adopting a colour needs the object and its reach; a plain add needs neither.');
		}
		let adoptEntity: SceneEntity | null = null;
		if (adopt) {
			if (request.intent.targets.length !== 1) return refuse('A palette adoption addresses exactly one object.');
			const problem = sceneEntityTargetProblem(request.intent.targets[0]!, adoptEntityId!, header.contentRevision);
			if (problem !== null) return refuse(problem.message);
			adoptEntity = before.entities.find((candidate) => candidate.id === adoptEntityId) ?? null;
			if (adoptEntity === null) return refuse('That object is not in the current revision.', 'unknown-entity');
			const instance = materialInstanceById(
				before.materials,
				(adoptEntity as SceneEntity & { materialInstanceId?: string }).materialInstanceId
			);
			if (instance?.overrides?.color === undefined || typeof instance.overrides.color !== 'string' || instance.overrides.color !== parsedColor.value) {
				return refuse('The current colour is inherited, so there is no literal to save.', 'invalid-adopt');
			}
		} else if (request.intent.targets.length !== 0) {
			return refuse('A palette add with no adopted object addresses no subject.');
		}

		// The slot id is the first allocation; an adopted shared/curated Finish may
		// additionally create a project Finish, which is the second.
		const allocations = request.allocatedIds;
		if (allocations.length === 0 || allocations[0]!.kind !== 'scene-palette-slot') {
			return refuse('A palette add needs one allocated palette slot id.', 'missing-allocation');
		}
		let finishAllocation: string | null = null;
		if (adoptEntity !== null) {
			const adoptFinish = finishOf(adoptEntity, before.materials);
			if (adoptFinish === null || adoptFinish === 'model-own') {
				return refuse('That object has no editable Finish.', 'not-editable');
			}
		}
		if (allocations.length > 2) {
			return refuse('A palette add takes one slot id and at most one Finish id.', 'unexpected-allocation');
		}
		if (allocations.length === 2) {
			if (!['scene-finish', 'scene-material'].includes(allocations[1]!.kind)) {
				return refuse('The second allocation must be a Finish id.', 'unexpected-allocation');
			}
			finishAllocation = allocations[1]!.id;
		}

		const slots: ScenePaletteSlot[] = [
			...(before.palette ?? []),
			{ id: allocations[0]!.id, name: nextPaletteName(before.palette), color: parsedColor.value as string }
		];
		let scene: SceneDocument = { ...before, palette: slots };
		let changedEntityIds: readonly string[] = [];
		let subjectIds: readonly string[] = [];
		let addedMaterials: readonly string[] = [];
		let changedMaterials: readonly string[] = [];
		let removedMaterials: readonly string[] = [];
		if (adoptEntity !== null) {
			const edit = planEdit(scene, {
				layout: envelope.units.layout.data,
				entityId: adoptEntity.id,
				from: finishOf(adoptEntity, before.materials)!,
				reach: reach!,
				mode: mode as 'just-this' | 'all' | 'in-place',
				edit: { color: { slot: allocations[0]!.id } },
				allocateId: finishAllocation,
				options,
				materialRecipes: materialRecipesOf(envelope)
			});
			if (edit.kind === 'rejected') return refuse(edit.message, edit.code);
			scene = edit.scene;
			changedEntityIds = edit.changedEntityIds;
			subjectIds = edit.subjectIds;
			addedMaterials = edit.addedMaterials;
			changedMaterials = edit.changedMaterials;
			removedMaterials = edit.removedMaterials;
		}
		const grant: Partial<SceneRecordScope> = {
			palette: { change: 'slots' },
			changedEntityIds,
			changedEntityFields: changedEntityIds.length === 0 ? [] : ['materialId', 'materialInstanceId'],
			materials: materialGrant({
				added: addedMaterials,
				changed: changedMaterials,
				removed: removedMaterials
			})
		};
		return complete(scene, grant, subjectIds, ['palette', 'materials']);
}

export function planScenePaletteSlotSet(context: FinishPlanContext): Result {
	const { request, before, reader, complete } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['slotId', 'color']);
		const slotId = payload === null ? null : reader.opaqueId(payload.slotId, '$.payload.slotId');
		const parsedColor = payload === null ? null : readColor(reader, payload.color, '$.payload.color');
		if (slotId === null || parsedColor === null || !parsedColor.ok || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A palette slot and colour are required.');
		}
		if (request.intent.targets.length !== 0) return refuse('A palette colour addresses no Scene subject.');
		const slot = before.palette?.find((entry) => entry.id === slotId);
		if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
		if (slot.color === parsedColor.value) return refuse('That palette colour is unchanged.', 'no-change');
		const palette = before.palette!.map((entry) =>
			entry.id === slotId ? { ...entry, color: parsedColor.value as string } : entry
		);
		return complete({ ...before, palette }, { palette: { change: 'slots' } }, [], ['palette']);
}

export function planScenePaletteSlotRename(context: FinishPlanContext): Result {
	const { request, options, envelope, before, reader, complete, materialGrant } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['slotId', 'name']);
		const slotId = payload === null ? null : reader.opaqueId(payload.slotId, '$.payload.slotId');
		const rawName = payload === null ? null : reader.string(payload.name, '$.payload.name');
		if (slotId === null || rawName === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'A palette slot and name are required.');
		}
		if (request.intent.targets.length !== 0) return refuse('A palette name addresses no Scene subject.');
		const name = rawName.trim();
		if (name.length === 0 || name.length > PALETTE_NAME_MAX_LENGTH) {
			return refuse(`A palette name must be 1 to ${PALETTE_NAME_MAX_LENGTH} characters.`, 'invalid-name');
		}
		const slot = before.palette?.find((entry) => entry.id === slotId);
		if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
		if (slot.name === name) return refuse('That palette name is unchanged.', 'no-change');
		const palette = before.palette!.map((entry) =>
			entry.id === slotId ? { ...entry, name } : entry
		);
		if (options.treatmentFacts === undefined) {
			return complete({ ...before, palette }, { palette: { change: 'slots' } }, [], ['palette']);
		}
		// Naming: followers whose names are still generated take the new slot name.
		const recipes = materialRecipesOf(envelope);
		const was = nameContextOf(options, recipes, before.palette);
		const now = nameContextOf(options, recipes, palette);
		const renamed: string[] = [];
		let materials = [...before.materials];
		for (const follower of paletteFollowers(before.materials, slotId)) {
			if (isPristineInstance(follower) || !isGeneratedFinishName(follower.name, follower, was)) continue;
			const label = uniqueFinishName(generatedFinishName(follower, now), materials, follower.id);
			if (label === follower.name) continue;
			materials = materials.map((instance) => (instance.id === follower.id ? { ...instance, name: label } : instance));
			renamed.push(follower.id);
		}
		if (renamed.length === 0) {
			return complete({ ...before, palette }, { palette: { change: 'slots' } }, [], ['palette']);
		}
		return complete(
			{ ...before, palette, materials },
			{ palette: { change: 'slots' }, materials: materialGrant({ changed: renamed }) },
			[],
			['palette', 'materials']
		);
}

export function planScenePaletteAdopt(context: FinishPlanContext): Result {
	const { request, before, reader, complete, materialGrant } = context;
		const payload = reader.object(request.intent.payload, '$.payload', ['mapping']);
		const mapping = payload === null ? null : readAdoptionMapping(reader, payload.mapping);
		if (payload === null || mapping === null || reader.issues.length > 0) {
			return refuse(reader.issues[0]?.message ?? 'An adoption mapping is required.');
		}
		if (request.intent.targets.length !== 0) return refuse('Adoption addresses no Scene subject.');
		if (before.palette === undefined || before.palette.length === 0) {
			return refuse('This World has no palette to adopt.', 'no-palette');
		}
		const plan = planPaletteAdoption(before);
		const rows = new Map(plan.rows.map((row) => [row.color, row]));
		const seen = new Set<string>();
		for (const entry of mapping) {
			if (seen.has(entry.color)) return refuse('That adoption mapping repeats a colour.', 'stale-adoption');
			seen.add(entry.color);
			const row = rows.get(entry.color);
			if (row === undefined) return refuse('The palette changed since this preview was made.', 'stale-adoption');
			const slot = before.palette.find((candidate) => candidate.id === entry.slotId);
			if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
			if (
				row.slotId !== entry.slotId ||
				row.slotColor !== entry.slotColor ||
				slot.color.toLowerCase() !== entry.slotColor
			) {
				return refuse('The palette changed since this preview was made.', 'stale-adoption');
			}
		}
		if (seen.size !== plan.rows.length) {
			return refuse('The palette changed since this preview was made.', 'stale-adoption');
		}

		const targets = new Map(mapping.map((entry) => [entry.color, entry.slotId]));
		const changedMaterials: string[] = [];
		const materials = before.materials.map((instance) => {
			const color = instance.overrides?.color;
			if (typeof color !== 'string' || instance.overrides?.maps?.color != null) return instance;
			const slotId = targets.get(color.toLowerCase());
			if (slotId === undefined) return instance;
			changedMaterials.push(instance.id);
			return { ...instance, overrides: { ...instance.overrides, color: { slot: slotId } } };
		});
		if (changedMaterials.length === 0) return refuse('Every Finish already follows the palette.', 'no-change');
		return complete(
			{ ...before, materials },
			{ materials: materialGrant({ changed: changedMaterials }) },
			[],
			['materials']
		);
}

export function planScenePaletteSlotRemove(context: FinishPlanContext): Result {
	const { request, before, reader, complete, materialGrant } = context;
	// scene-palette-slot-remove
	const payload = reader.object(request.intent.payload, '$.payload', ['slotId']);
	const slotId = payload === null ? null : reader.opaqueId(payload.slotId, '$.payload.slotId');
	if (slotId === null || reader.issues.length > 0) {
		return refuse(reader.issues[0]?.message ?? 'A palette slot is required.');
	}
	if (request.intent.targets.length !== 0) return refuse('Removing a palette colour addresses no Scene subject.');
	const slot = before.palette?.find((entry) => entry.id === slotId);
	if (slot === undefined) return refuse('That palette colour no longer exists.', 'unknown-slot');
	const followers = paletteFollowers(before.materials, slotId);
	const materials = literalizePaletteFollowers(before.materials, slotId, slot.color);
	const remaining = before.palette!.filter((entry) => entry.id !== slotId);
	const after: SceneDocument = {
		...before,
		materials,
		...(remaining.length === 0 ? { palette: undefined } : { palette: remaining })
	};
	if (remaining.length === 0) delete (after as { palette?: unknown }).palette;
	return complete(
		after,
		{
			palette: { change: 'slots' },
			materials: materialGrant({ changed: followers.map((instance) => instance.id) })
		},
		[],
		['palette', 'materials']
	);

}

