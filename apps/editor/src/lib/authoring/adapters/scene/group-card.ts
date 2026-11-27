/**
 * The Group, Member and Set Cards' commands.
 *
 * Every command is one registered G1a planner call and one Undo: Group, Ungroup,
 * rename, Duplicate, Erase, Showcase and Group with…. Nothing here writes the
 * Scene itself, opens a lease or builds a second selection model; the Card and
 * the Index only render what these actions return.
 */
import type { SceneEntity, SceneObjectCluster } from '@portfolio/project-model/scene';
import type {
	StageAdapterBinding,
	StageAdapterServices,
	StageCardAction,
	StageCardFact,
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import {
	artworkLightBounds,
	showcaseRecipe,
	unionLightItBounds,
	washRecipe,
	pictureSpotRecipe,
	horizontalFront,
	type LightItBounds,
} from '../../look/light-recipes';
import { nextEntityName } from '../../scene/entity-names';
import {
	sceneClusterById,
	sceneClusterMemberIds,
	sceneClusterMembers,
	sceneClusterReference,
	sceneEntityTargetReference,
} from '../../scene/selection-target';
import { groupWithOfferFor, setGroupWithOffer } from './group-offer';

async function acceptGroup(
	services: StageAdapterServices,
	kind: string,
	payload: unknown,
	targets: AuthoringIntent['targets'],
	allocatedIds: AuthoringIntent['allocatedIds'] = [],
): Promise<{ readonly kind: string; readonly message?: string }> {
	const snapshot = services.stage.snapshot();
	try {
		return await services.authoring.accept({
			version: 1,
			kind,
			operationId: globalThis.crypto.randomUUID(),
			expectedRevision: snapshot.acceptedRevision,
			targets,
			payload: payload as never,
			capturedInputs: [],
			allocatedIds,
		});
	} finally {
		services.stage.notifySurfaceChange();
	}
}

function selectGroup(services: StageAdapterServices, clusterId: string): void {
	const revision = services.stage.snapshot().domain.unitRevisions.scene;
	const reference = sceneClusterReference(clusterId, revision);
	services.stage.setSelection({ ordered: [{ reference }], primary: reference });
}

function selectEntities(services: StageAdapterServices, ids: readonly string[]): void {
	const revision = services.stage.snapshot().domain.unitRevisions.scene;
	const ordered = ids.map((id) => ({
		reference: sceneEntityTargetReference(id, revision),
	}));
	services.stage.setSelection({
		ordered,
		primary: ordered.length === 1 ? ordered[0]!.reference : null,
	});
}

function contactsOf(
	services: StageAdapterServices,
	members: readonly SceneEntity[],
): { readonly entityId: string; readonly contactMinY: number }[] | null {
	const contacts: { readonly entityId: string; readonly contactMinY: number }[] = [];
	for (const member of members) {
		if (member.kind === 'light' || member.kind === 'artwork') continue;
		const contact = services.stage.sceneBounds(member.id)?.min[1];
		if (contact === undefined || !Number.isFinite(contact)) return null;
		contacts.push({ entityId: member.id, contactMinY: contact });
	}
	return contacts;
}

function nextGroupName(
	scene: { readonly clusters?: readonly { readonly name: string }[] },
	base: string,
): string {
	const names = new Set((scene.clusters ?? []).map((cluster) => cluster.name));
	if (!names.has(base)) return base;
	for (let index = 2; index < 1000; index += 1) {
		const candidate = `${base} ${index}`;
		if (!names.has(candidate)) return candidate;
	}
	return base;
}

function boundsOf(
	services: StageAdapterServices,
	entities: readonly SceneEntity[],
): LightItBounds | null {
	const bounds: LightItBounds[] = [];
	for (const entity of entities) {
		const entry =
			entity.kind === 'artwork'
				? artworkLightBounds(entity)
				: services.stage.sceneBounds(entity.id);
		if (entry === null) return null;
		bounds.push(entry);
	}
	return unionLightItBounds(bounds);
}

/** The group Card's read-only facts: its size and its rigid promise. */
export function groupCardFacts(cluster: SceneObjectCluster): readonly StageCardFact[] {
	return [
		{ label: 'Members', value: String(cluster.memberIds.length) },
		{ label: 'Pose', value: 'Rigid' },
	];
}

/** Rename through the registered `scene-group-rename` planner. */
export function groupCardName(
	services: StageAdapterServices,
	cluster: SceneObjectCluster,
): ReturnType<NonNullable<StageAdapterBinding['cardName']>> {
	return {
		value: cluster.name,
		async commit(name: string) {
			const outcome = await acceptGroup(
				services,
				'scene-group-rename',
				{ clusterId: cluster.id, name },
				[sceneClusterReference(cluster.id, services.stage.snapshot().domain.unitRevisions.scene)],
			);
			return outcome.kind === 'refused'
				? {
						kind: 'refused',
						code: 'refused',
						message: outcome.message ?? 'The rename was refused.',
					}
				: { kind: 'accepted' };
		},
	};
}

function duplicateGroupAction(
	services: StageAdapterServices,
	cluster: SceneObjectCluster,
	members: readonly SceneEntity[],
): StageCardAction {
	return {
		id: 'scene-group-duplicate',
		label: 'Duplicate',
		group: 'secondary',
		detail: `Add one copy of ${cluster.name}'s ${members.length} items, as a new group. Each item keeps its kind. Undo removes them.`,
		async run() {
			const contacts = contactsOf(services, members);
			if (contacts === null) {
				return {
					kind: 'refused',
					message: 'A member has no captured contact height, so the group copy has no floor.',
				};
			}
			const copies = members.map((member) => ({
				sourceEntityId: member.id,
				entityId: `entity-${globalThis.crypto.randomUUID()}`,
			}));
			const newClusterId = `cluster-${globalThis.crypto.randomUUID()}`;
			const outcome = await acceptGroup(
				services,
				'scene-group-duplicate',
				{ clusterId: cluster.id, copies, newClusterId, contacts },
				[sceneClusterReference(cluster.id, services.stage.snapshot().domain.unitRevisions.scene)],
			);
			if (outcome.kind === 'refused')
				return { kind: 'refused', message: outcome.message ?? 'The copy was refused.' };
			if (outcome.kind === 'no-op') return { kind: 'no-op' };
			selectGroup(services, newClusterId);
			return { kind: 'accepted' };
		},
	};
}

function ungroupAction(
	services: StageAdapterServices,
	cluster: SceneObjectCluster,
): StageCardAction {
	return {
		id: 'scene-group-ungroup',
		label: 'Ungroup',
		group: 'primary',
		detail: `Dissolve ${cluster.name}; its ${cluster.memberIds.length} items stay selected as a set. One Undo restores the group.`,
		async run() {
			const outcome = await acceptGroup(
				services,
				'scene-group-ungroup',
				{ clusterId: cluster.id },
				[sceneClusterReference(cluster.id, services.stage.snapshot().domain.unitRevisions.scene)],
			);
			if (outcome.kind === 'refused')
				return { kind: 'refused', message: outcome.message ?? 'The group could not be ungrouped.' };
			if (outcome.kind === 'no-op') return { kind: 'no-op' };
			selectEntities(services, cluster.memberIds);
			return { kind: 'accepted' };
		},
	};
}

function eraseGroupAction(
	services: StageAdapterServices,
	cluster: SceneObjectCluster,
): StageCardAction {
	const members = sceneClusterMembers(stageScene(services.stage.snapshot()), cluster.id);
	const names = members.map((member) => member.name);
	return {
		id: 'scene-group-erase',
		label: 'Erase group',
		destructive: true,
		detail: `Erases ${cluster.name} and its ${members.length} items: ${names.join(', ')}. One Undo restores them.`,
		async run() {
			const outcome = await acceptGroup(services, 'scene-group-erase', { clusterId: cluster.id }, [
				sceneClusterReference(cluster.id, services.stage.snapshot().domain.unitRevisions.scene),
			]);
			return outcome.kind === 'refused'
				? { kind: 'refused', message: outcome.message ?? 'The group could not be erased.' }
				: outcome.kind === 'no-op'
					? { kind: 'no-op' }
					: { kind: 'accepted' };
		},
	};
}

/** Showcase: Key, Fill and Rim as a new group; the subject stays out of it. */
function showcaseAction(
	services: StageAdapterServices,
	input: {
		readonly entities: readonly SceneEntity[];
		readonly front: import('@portfolio/project-model/scene').Vec3 | undefined;
		readonly subjectNames: string;
	},
): StageCardAction {
	return {
		id: 'scene-light-showcase',
		label: 'Showcase',
		detail: `Places Key, Fill and Rim spots around ${input.subjectNames} as a new group, Showcase. The subject stays out of it. One undo.`,
		async run() {
			const bounds = boundsOf(services, input.entities);
			if (bounds === null)
				return { kind: 'refused', message: 'The selection has no evaluated bounds to light.' };
			const prepared = showcaseRecipe({ bounds, front: input.front });
			if (prepared.kind === 'refused') return { kind: 'refused', message: prepared.message };
			const live = services.stage.snapshot();
			const clusterId = `cluster-${globalThis.crypto.randomUUID()}`;
			const lights = prepared.recipes.map((recipe, index) => ({
				entityId: `light-${globalThis.crypto.randomUUID()}`,
				light: 'spot' as const,
				name: nextEntityName(stageScene(live), recipe.name),
				color: recipe.color,
				intensity: recipe.intensity,
				castShadow: recipe.castShadow,
				position: [...recipe.position],
				rotation: [...recipe.rotation],
				angle: recipe.angle,
				range: recipe.range,
				...(index === -1 ? {} : {}),
			}));
			const outcome = await acceptGroup(
				services,
				'create-light-rig',
				{
					clusterId,
					name: nextGroupName(stageScene(live), 'Showcase'),
					lights,
				},
				[],
				lights.map((light) => ({ kind: 'scene-entity' as const, id: light.entityId })),
			);
			if (outcome.kind === 'refused')
				return { kind: 'refused', message: outcome.message ?? 'The Showcase was refused.' };
			if (outcome.kind === 'no-op') return { kind: 'no-op' };
			selectGroup(services, clusterId);
			return { kind: 'accepted' };
		},
	};
}

/** One ordinary Light it for a group or set: a Wash fitted to the union. */
function lightItAction(
	services: StageAdapterServices,
	entities: readonly SceneEntity[],
	subjectNames: string,
): StageCardAction {
	return {
		id: 'scene-light-it',
		label: 'Light it',
		detail: `Places one Wash covering ${subjectNames}. It is not grouped. One undo.`,
		async run() {
			const bounds = boundsOf(services, entities);
			if (bounds === null)
				return { kind: 'refused', message: 'The selection has no evaluated bounds to light.' };
			const single = entities.length === 1 ? entities[0]! : null;
			const prepared =
				single !== null && single.kind === 'artwork'
					? pictureSpotRecipe(single)
					: washRecipe({ bounds, front: horizontalFront(single?.rotation) });
			if (prepared.kind === 'refused') return { kind: 'refused', message: prepared.message };
			const live = services.stage.snapshot();
			const lightId = `light-${globalThis.crypto.randomUUID()}`;
			const { recipe } = prepared;
			const outcome = await acceptGroup(
				services,
				'create-light',
				{
					light: 'spot',
					name: nextEntityName(stageScene(live), recipe.name),
					color: recipe.color,
					intensity: recipe.intensity,
					castShadow: recipe.castShadow,
					position: [...recipe.position],
					rotation: [...recipe.rotation],
					angle: recipe.angle,
					range: recipe.range,
				},
				[],
				[{ kind: 'scene-entity', id: lightId }],
			);
			if (outcome.kind === 'refused')
				return { kind: 'refused', message: outcome.message ?? 'The light was refused.' };
			if (outcome.kind === 'no-op') return { kind: 'no-op' };
			const reference = sceneEntityTargetReference(
				lightId,
				services.stage.snapshot().domain.unitRevisions.scene,
			);
			services.stage.setSelection({ ordered: [{ reference }], primary: reference });
			return { kind: 'accepted' };
		},
	};
}

function lightItForGroup(
	services: StageAdapterServices,
	members: readonly SceneEntity[],
): readonly StageCardAction[] {
	const lit = members.some((member) => member.kind !== 'light');
	if (!lit) return [];
	const subjectNames = members.map((member) => member.name).join(', ');
	const frontMember = members.find((member) => member.kind !== 'light') ?? members[0]!;
	return [
		lightItAction(services, members, subjectNames),
		showcaseAction(services, {
			entities: members,
			front: frontMember.rotation,
			subjectNames,
		}),
	];
}

export function groupCardActions(
	services: StageAdapterServices,
	cluster: SceneObjectCluster,
): readonly StageCardAction[] {
	const members = sceneClusterMembers(stageScene(services.stage.snapshot()), cluster.id);
	return [
		...lightItForGroup(services, members),
		duplicateGroupAction(services, cluster, members),
		ungroupAction(services, cluster),
		eraseGroupAction(services, cluster),
	];
}

/** The set Card's actions: Group, Light it (with Showcase) and Clear. */
export function groupSetActions(services: StageAdapterServices): readonly StageCardAction[] {
	const snapshot = services.stage.snapshot();
	const scene = stageScene(snapshot);
	const selection = services.stage.selectionState();
	if (selection.ordered.length < 2) return [];
	const entries = selection.ordered.map((entry) => entry.reference);
	if (entries.some((reference) => reference.domain !== 'scene')) return [];
	const groups = entries.filter((reference) => reference.subject.kind === 'cluster');
	const memberIds: string[] = [];
	const entities: SceneEntity[] = [];
	for (const reference of entries) {
		if (reference.domain !== 'scene') continue;
		if (reference.subject.kind === 'cluster') {
			for (const id of sceneClusterMemberIds(scene, reference.subject.id)) {
				const member = scene.entities.find((entity) => entity.id === id);
				if (member !== undefined) entities.push(member);
			}
		} else if (reference.subject.kind === 'entity') {
			memberIds.push(reference.subject.id);
			const member = scene.entities.find((entity) => entity.id === reference.subject.id);
			if (member !== undefined) entities.push(member);
		}
	}
	const groupNames = groups
		.map((reference) => sceneClusterById(scene, reference.subject.id)?.name ?? reference.subject.id)
		.join(', ');
	const groupBlocked = groups.length > 0;
	const lightBlocked = entities.some((entity) => entity.kind === 'light');
	const names = entities.map((entity) => entity.name).join(', ');
	return [
		{
			id: 'scene-group-create',
			label: 'Group',
			group: 'primary',
			detail: groupBlocked
				? `Group: a group can’t hold another group. Ungroup ${groupNames} first.`
				: `Group the ${entities.length} selected items as one rigid group. Each keeps its own kind and pose. One Undo.`,
			async run() {
				if (groupBlocked) {
					return {
						kind: 'refused',
						message: `A group can’t hold another group. Ungroup ${groupNames} first.`,
					};
				}
				const clusterId = `cluster-${globalThis.crypto.randomUUID()}`;
				const outcome = await acceptGroup(
					services,
					'scene-group-create',
					{
						clusterId,
						memberIds,
						name: nextGroupName(scene, 'Group'),
					},
					[],
				);
				if (outcome.kind === 'refused')
					return { kind: 'refused', message: outcome.message ?? 'The group was refused.' };
				if (outcome.kind === 'no-op') return { kind: 'no-op' };
				selectGroup(services, clusterId);
				return { kind: 'accepted' };
			},
		},
		...(lightBlocked
			? [
					{
						id: 'scene-light-it',
						label: 'Light it',
						detail: 'Light it: a light cannot be lit; select Artwork or an object.',
						async run() {
							return {
								kind: 'refused' as const,
								message: 'A light cannot be lit; select Artwork or an object.',
							};
						},
					},
				]
			: [
					lightItAction(services, entities, names),
					showcaseAction(services, {
						entities,
						front: entities[0]?.rotation,
						subjectNames: names,
					}),
				]),
	];
}

/** The light Card's Group with… offer, when Light it left one for this light. */
export function groupWithAction(
	services: StageAdapterServices,
	lightId: string,
): StageCardAction | null {
	const snapshot = services.stage.snapshot();
	const offer = groupWithOfferFor(snapshot.acceptedRevision.projectId, lightId);
	if (offer === null) return null;
	// The offer lives only while its own light is the selection.
	const primary = services.stage.selectionState().primary;
	if (
		primary?.domain !== 'scene' ||
		primary.subject.kind !== 'entity' ||
		primary.subject.id !== lightId
	)
		return null;
	const scene = stageScene(snapshot);
	const subject = scene.entities.find((entity) => entity.id === offer.subjectId);
	if (subject === undefined) return null;
	return {
		id: 'scene-group-with',
		label: `Group with “${subject.name}”`,
		detail: `Groups ${subject.name} and ${offer.subjectName} and selects the group. One undo.`,
		async run() {
			const clusterId = `cluster-${globalThis.crypto.randomUUID()}`;
			const outcome = await acceptGroup(
				services,
				'scene-group-create',
				{
					clusterId,
					memberIds: [subject.id, lightId],
					name: nextGroupName(scene, 'Group'),
				},
				[],
			);
			if (outcome.kind === 'refused')
				return { kind: 'refused', message: outcome.message ?? 'The group was refused.' };
			if (outcome.kind === 'no-op') return { kind: 'no-op' };
			selectGroup(services, clusterId);
			return { kind: 'accepted' };
		},
	};
}

/** Remember the Light it offer after the light became the selection. */
export function rememberGroupWithOffer(
	services: StageAdapterServices,
	lightId: string,
	subject: SceneEntity,
): void {
	setGroupWithOffer({
		projectId: services.stage.snapshot().acceptedRevision.projectId,
		lightId,
		subjectId: subject.id,
		subjectName: subject.name,
	});
}
