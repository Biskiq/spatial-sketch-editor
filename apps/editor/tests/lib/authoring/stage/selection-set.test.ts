/**
 * G1b — a selection set has no primary.
 *
 * The set is structural: two or more ordered identities, always `primary: null`,
 * however the caller built it. A single identity keeps its primary, so every
 * existing single-subject consumer is unchanged. The group-first target resolver
 * is the one place that decides whether a hit addresses a member or its group.
 */
import { describe, expect, it } from 'vitest';
import {
	admitSelection,
	isSelectionSet,
	primaryEntry,
	sameReference,
	type StageSelectionState,
} from '$lib/authoring/stage/semantic-selection';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import {
	sceneClusterOf,
	sceneSelectionTargetForHit,
	sceneTopLevelTarget,
	selectedSceneClusterId,
	topLevelSceneReference,
	ungroupedSceneEntityIds,
} from '$lib/authoring/scene/selection-target';
import { bootProject, sceneUnitWith } from '../../../kit';
import type { SceneEntity } from '@portfolio/project-model/scene';

const entity = (id: string): SceneEntity => ({
	id,
	name: id,
	kind: 'primitive',
	primitive: 'box',
	position: [0, 0, 0],
	rotation: [0, 0, 0],
	dimensions: { width: 1, height: 1, depth: 1 },
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true,
});

describe('selection sets', () => {
	it('normalizes two or more identities to no primary, whatever the caller supplied', async () => {
		const { snapshot } = await bootProject({
			id: 'set-invariant',
			scene: sceneUnitWith([entity('a'), entity('b'), entity('c')]),
		});
		const revision = snapshot.domain.unitRevisions.scene;
		const a = sceneEntityReference('a', revision);
		const b = sceneEntityReference('b', revision);
		const c = sceneEntityReference('c', revision);
		const admitted = admitSelection(
			{
				ordered: [{ reference: a }, { reference: b }],
				// A caller that still thinks in "first is primary" is normalized,
				// never refused: the invariant is the shape.
				primary: a,
			},
			snapshot,
		);
		expect('kind' in admitted).toBe(false);
		const set = admitted as StageSelectionState;
		expect(set.primary).toBeNull();
		expect(set.ordered).toHaveLength(2);
		expect(isSelectionSet(set)).toBe(true);
		expect(primaryEntry(set)).toBeNull();

		const three = admitSelection(
			{ ordered: [{ reference: a }, { reference: b }, { reference: c }], primary: null },
			snapshot,
		) as StageSelectionState;
		expect(three.primary).toBeNull();
		expect(isSelectionSet(three)).toBe(true);

		const single = admitSelection(
			{ ordered: [{ reference: a }], primary: a },
			snapshot,
		) as StageSelectionState;
		expect(single.primary !== null && sameReference(single.primary, a)).toBe(true);
		expect(isSelectionSet(single)).toBe(false);
		expect(sameReference(primaryEntry(single)!.reference, single.primary!)).toBe(true);
	});

	it('refuses a single identity with no primary or with a primary it does not hold', async () => {
		const { snapshot } = await bootProject({
			id: 'set-refusals',
			scene: sceneUnitWith([entity('a'), entity('b')]),
		});
		const revision = snapshot.domain.unitRevisions.scene;
		const a = sceneEntityReference('a', revision);
		const b = sceneEntityReference('b', revision);
		expect(admitSelection({ ordered: [{ reference: a }], primary: null }, snapshot)).toMatchObject({
			kind: 'refused',
			code: 'invalid-primary',
		});
		expect(admitSelection({ ordered: [{ reference: a }], primary: b }, snapshot)).toMatchObject({
			kind: 'refused',
			code: 'invalid-primary',
		});
		expect(admitSelection({ ordered: [], primary: a }, snapshot)).toMatchObject({
			kind: 'refused',
			code: 'invalid-primary',
		});
	});
});

describe('group-first selection targets', () => {
	const scene = {
		entities: [entity('a'), entity('b'), entity('loose')],
		clusters: [{ id: 'still-life', name: 'Still life', memberIds: ['a', 'b'] }],
	};
	const revision = 'rev-1';
	const a = sceneEntityReference('a', revision);
	const loose = sceneEntityReference('loose', revision);

	it('addresses the group when nothing (or another subject) is selected', () => {
		expect(sceneTopLevelTarget(scene, 'a')).toEqual({ kind: 'cluster', id: 'still-life' });
		expect(sceneTopLevelTarget(scene, 'loose')).toEqual({ kind: 'entity', id: 'loose' });
		expect(sceneClusterOf(scene, 'loose')).toBeNull();
		expect(
			sceneSelectionTargetForHit({
				scene,
				entityId: 'a',
				contentRevision: revision,
				selected: [],
				additive: false,
			}),
		).toMatchObject({ subject: { kind: 'cluster', id: 'still-life' } });
		expect(
			sceneSelectionTargetForHit({
				scene,
				entityId: 'a',
				contentRevision: revision,
				selected: [loose],
				additive: false,
			}),
		).toMatchObject({ subject: { kind: 'cluster', id: 'still-life' } });
	});

	it('drills into a member once the group (or a sibling) is the single selection', () => {
		const groupRef = sceneSelectionTargetForHit({
			scene,
			entityId: 'a',
			contentRevision: revision,
			selected: [],
			additive: false,
		});
		expect(
			sceneSelectionTargetForHit({
				scene,
				entityId: 'a',
				contentRevision: revision,
				selected: [groupRef],
				additive: false,
			}),
		).toMatchObject({ subject: { kind: 'entity', id: 'a' } });
		expect(
			sceneSelectionTargetForHit({
				scene,
				entityId: 'b',
				contentRevision: revision,
				selected: [a],
				additive: false,
			}),
		).toMatchObject({ subject: { kind: 'entity', id: 'b' } });
	});

	it('normalizes a set member to its group, so a set never mixes a group with its member', () => {
		expect(
			sceneSelectionTargetForHit({
				scene,
				entityId: 'a',
				contentRevision: revision,
				selected: [a],
				additive: true,
			}),
		).toMatchObject({ subject: { kind: 'cluster', id: 'still-life' } });
		expect(topLevelSceneReference(scene, a)).toMatchObject({
			subject: { kind: 'cluster', id: 'still-life' },
		});
		expect(selectedSceneClusterId([sceneEntityReference('a', revision)])).toBeNull();
		expect(ungroupedSceneEntityIds(scene, [a, loose])).toEqual([]);
		expect(ungroupedSceneEntityIds(scene, [loose])).toEqual(['loose']);
	});
});
