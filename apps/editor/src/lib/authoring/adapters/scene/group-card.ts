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
import { objectContact } from './object-readings';
import { nextEntityName } from '../../scene/entity-names';
import {
	sceneClusterById,
	sceneClusterMemberIds,
	sceneClusterMembers,
	sceneClusterOf,
	sceneClusterReference,
	sceneEntityTargetReference,
} from '../../scene/selection-target';
import { nextGroupName } from './group-names';
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
		const contact = objectContact(services, member);
		if (contact === null) return null;
		contacts.push({ entityId: member.id, contactMinY: contact });
	}
	return contacts;
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
		inline: true,
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
		inline: true,
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
		label: `Erase group · ${members.length} items`,
		destructive: true,
		confirmInCard: true,
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
export function showcaseAction(
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
			const lights = prepared.recipes.map((recipe) => ({
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
	const single = entities.length === 1 ? entities[0] : undefined;
	const picture = single?.kind === 'artwork';
	return {
		id: 'scene-light-it',
		label: 'Light it',
		inline: true,
		optionLabel: picture ? 'Picture spot' : 'Wash',
		detail: picture
			? 'Places a Picture spot 1.4 m in front and 30° above, fitted to the Artwork. One Undo.'
			: `Places one Wash covering ${subjectNames}. One Undo.`,
		options: [showcaseAction(services, { entities, front: entities[0]?.rotation, subjectNames })],
		async run() {
			const bounds = boundsOf(services, entities);
			if (bounds === null)
				return { kind: 'refused', message: 'The selection has no evaluated bounds to light.' };
			const prepared =
				single?.kind === 'artwork'
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
	const subjects = members.filter((member) => member.kind !== 'light');
	return subjects.length === 0
		? []
		: [lightItAction(services, subjects, subjects.map((subject) => subject.name).join(', '))];
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
				if (member !== undefined && member.kind !== 'light') entities.push(member);
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
			inline: true,
			disabled: groupBlocked,
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
		...(lightBlocked || entities.length === 0
			? [
					{
						id: 'scene-light-it',
						label: 'Light it',
						inline: true,
						disabled: true,
						detail: lightBlocked
							? 'Light it: a light cannot be lit; select Artwork or an object.'
							: 'Light it: select at least one object or Artwork.',
						async run() {
							return {
								kind: 'refused' as const,
								message: 'Select Artwork or an object to light.',
							};
						},
					},
				]
			: [lightItAction(services, entities, names)]),
	];
}

/** The light Card's Group with… offer, when Light it left one for this light. */
export function groupWithAction(
	services: StageAdapterServices,
	lightId: string,
): StageCardAction | null {
	const snapshot = services.stage.snapshot();
	const offer = groupWithOfferFor(services.stage.session, lightId);
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
	const light = scene.entities.find((entity) => entity.id === lightId && entity.kind === 'light');
	if (
		subject === undefined ||
		light === undefined ||
		sceneClusterOf(scene, subject.id) ||
		sceneClusterOf(scene, lightId)
	)
		return null;
	return {
		id: 'scene-group-with',
		label: `Group with “${subject.name}”`,
		detail: `Groups ${subject.name} and ${light.name} and selects the group. One Undo.`,
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
	setGroupWithOffer(services.stage.session, { lightId, subjectId: subject.id });
}
