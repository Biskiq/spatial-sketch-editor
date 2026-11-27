/**
 * G1b — the Stage shell's group-first selection route.
 *
 * A member hit addresses its group until the group (or a sibling member) is the
 * one selected subject; then the same hit drills into the member. An additive
 * tap toggles top-level targets, so a set never holds a group and its member.
 * Escape's first rung returns a drilled member to its group. Every write goes
 * through the canonical `setSelection`, exactly as the Stage does.
 */
import { describe, expect, it } from 'vitest';
import { admitSelection, sameReference, type StageSelectionState } from '$lib/authoring/stage/semantic-selection';
import { createStageShellSelection } from '$lib/authoring/stage/route/stage-shell-selection';
import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
import { sceneClusterReference } from '$lib/authoring/scene/selection-target';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';
import { bootProject, sceneUnitWith } from '../../../kit';
import type { SceneEntity, SceneObjectCluster } from '@portfolio/project-model/scene';

const box = (id: string): SceneEntity => ({
	id,
	name: id,
	kind: 'primitive',
	primitive: 'box',
	position: [0, 0.5, 0],
	rotation: [0, 0, 0],
	dimensions: { width: 1, height: 1, depth: 1 },
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true,
});

const CLUSTERS: SceneObjectCluster[] = [
	{ id: 'still-life', name: 'Still life', memberIds: ['a', 'b'] },
];

async function route() {
	const { snapshot } = await bootProject({
		id: 'group-route',
		scene: { ...sceneUnitWith([box('a'), box('b'), box('loose')]), clusters: CLUSTERS },
	});
	const revision = snapshot.domain.unitRevisions.scene;
	let state = admitSelection({ ordered: [], primary: null }, snapshot) as StageSelectionState;
	const shell = {
		stagePickPresentationId: null,
		setStagePickPresentationId: () => {},
		setCardOpen: () => {},
		requestCardRename: () => {}
	};
	const facade = {
		snapshot: () => snapshot,
		selectionState: () => state,
		setSelection: (next: { ordered: { reference: never }[]; primary: never }) => {
			const admitted = admitSelection(
				{ ordered: next.ordered, primary: next.primary } as never,
				snapshot,
			);
			if ('kind' in admitted) return { kind: 'refused', code: admitted.code };
			state = admitted as StageSelectionState;
			return { kind: 'selected' };
		},
		select: () => {},
		subjects: () => []
	} as unknown as StageFacade;
	const selection = createStageShellSelection({
		facade: () => facade,
		planView: () => null,
		shell: shell as never,
		selection: () => null,
		setSelection: () => {},
		clearExperienceFocus: () => {},
		experience: { active: () => null, lens: { selectSubject: () => {} } } as never,
		armWorldTool: () => {},
		selectMore: () => false,
		setSelectMore: () => {}
	});
	const hit = (id: string) => ({
		sourceId: `scene:${id}`,
		sourceKind: 'entity' as const,
		reference: sceneEntityReference(id, revision),
		worldPoint: [0, 0, 0] as [number, number, number]
	});
	const selectedIds = () =>
		state.ordered.map((entry) =>
			entry.reference.subject.kind === 'cluster'
				? `cluster:${entry.reference.subject.id}`
				: entry.reference.subject.id,
		);
	return {
		selection,
		hit,
		selectedIds,
		state: () => state,
		group: sceneClusterReference('still-life', revision)
	};
}

describe('group-first Stage selection', () => {
	it('selects the group on the first member press, then the member on the second', async () => {
		const fixture = await route();
		fixture.selection.selectHit(fixture.hit('a'));
		expect(fixture.selectedIds()).toEqual(['cluster:still-life']);

		fixture.selection.selectHit(fixture.hit('a'));
		expect(fixture.selectedIds()).toEqual(['a']);
	});

	it('drills into a sibling from an already selected group', async () => {
		const fixture = await route();
		fixture.selection.selectHit(fixture.hit('a'));
		fixture.selection.selectHit(fixture.hit('b'));
		expect(fixture.selectedIds()).toEqual(['b']);
	});

	it('toggles top-level targets into a primary-less set', async () => {
		const fixture = await route();
		fixture.selection.selectHit(fixture.hit('a'), { additive: true });
		expect(fixture.selectedIds()).toEqual(['cluster:still-life']);
		fixture.selection.selectHit(fixture.hit('loose'), { additive: true });
		expect(fixture.selectedIds()).toEqual(['cluster:still-life', 'loose']);
		expect(fixture.state().primary).toBeNull();
	});

	it('returns a drilled member to its group on the member → group Escape rung', async () => {
		const fixture = await route();
		fixture.selection.selectHit(fixture.hit('a'));
		expect(fixture.selection.drillOutOfGroup()).toBe(false);
		fixture.selection.selectHit(fixture.hit('a'));
		expect(fixture.selection.drillOutOfGroup()).toBe(true);
		expect(fixture.selectedIds()).toEqual(['cluster:still-life']);
	});

	it('leaves the rung to the next Escape handler for a top-level subject', async () => {
		const fixture = await route();
		fixture.selection.selectHit(fixture.hit('loose'));
		expect(fixture.selection.drillOutOfGroup()).toBe(false);
		expect(sameReference(fixture.hit('loose').reference, fixture.hit('loose').reference)).toBe(
			true,
		);
	});
});
