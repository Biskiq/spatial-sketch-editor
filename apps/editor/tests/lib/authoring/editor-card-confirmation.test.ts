// @vitest-environment jsdom
/**
 * A Card confirmation names **one exact action of one subject** (PR #201
 * peer review P2).
 *
 * The Stage contract lets every mounted adapter contribute actions for the same
 * subject, and it never caps how many of them are destructive (`EditorCard`'s
 * `actions` are published records; only `detail` is required of a destructive
 * one). So `Confirm` cannot be a fact about the subject as a whole — it has to be
 * a fact about the action whose disclosure the creator read. Before this
 * regression the Card keyed its confirmation by the subject plus the *entire*
 * action list, so reading one destructive action's consequences armed every
 * other destructive action beside it: pressing the neighbour ran it with no
 * disclosure at all.
 *
 * These are Card mounts, not route journeys. The route's own `Delete` route
 * already refuses unless the subject has exactly one destructive action
 * (`requestDelete`), so the hole was local to the Card's confirmation state and
 * fixed there.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
import type { StageCardActionRecord } from '$lib/authoring/stage/stage-facade';
import { reactiveCell } from './__fixtures__/reactive-cell.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

/** One destructive contributed action, with its own words and a spy for its run. */
function cardAction(id: string, adapterId: string, detail: string) {
	return {
		id,
		adapterId,
		label: id,
		detail,
		destructive: true,
		run: vi.fn(async () => ({ kind: 'accepted' as const }))
	} satisfies StageCardActionRecord;
}

function mountCard(options: {
	readonly identity?: () => { sourceId: string; label: string; kind: string; status: string };
	readonly actions?: () => readonly StageCardActionRecord[];
} = {}) {
	const identity =
		options.identity ?? (() => ({ sourceId: 'wall-a', label: 'Wall A', kind: 'wall', status: 'accepted' }));
	const actions = options.actions ?? (() => []);
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditorCard, {
		target,
		props: {
			get identity() {
				return identity();
			},
			facts: [],
			get actions() {
				return actions();
			},
			onClose: () => {},
			onFocusTask: () => {},
			onOpenTask: () => {},
			onBringIntoView: () => {}
		}
	});
	cleanup = () => void unmount(component);
	return target;
}

/** The action controls in contributed order, so duplicate ids stay addressable. */
function controls(target: HTMLElement): HTMLButtonElement[] {
	return [...target.querySelectorAll<HTMLButtonElement>('[data-card-actions] [data-card-action]')];
}

async function press(target: HTMLElement, index: number): Promise<void> {
	controls(target)[index]!.click();
	await tick();
}

describe('Card confirmation is bound to one action', () => {
	it('discloses each destructive action on its own and runs only the one confirmed', async () => {
		const remove = cardAction('wall-delete', 'layout', 'This deletes Wall wall-a.');
		const dissolve = cardAction(
			'wall-dissolve',
			'layout-probe',
			'This dissolves Wall wall-a, its Junctions and 1 hosted Opening.'
		);
		const target = mountCard({ actions: () => [remove, dissolve] });

		await press(target, 0);
		// The first press discloses its own words and writes nothing.
		expect(target.textContent).toContain(remove.detail);
		expect(controls(target)[0]!.textContent).toContain('Confirm');
		expect(remove.run).not.toHaveBeenCalled();

		// The neighbour is a different subject of confirmation: it discloses its own
		// consequences instead of spending the confirmation its neighbour opened.
		expect(controls(target)[1]!.textContent).not.toContain('Confirm');
		await press(target, 1);
		expect(target.textContent).toContain(dissolve.detail);
		expect(controls(target)[1]!.textContent).toContain('Confirm');
		expect(remove.run).not.toHaveBeenCalled();
		expect(dissolve.run).not.toHaveBeenCalled();

		// The second press on that action runs it, and only it.
		await press(target, 1);
		expect(dissolve.run).toHaveBeenCalledTimes(1);
		expect(remove.run).not.toHaveBeenCalled();
	});

	it('keeps two adapters\u2019 same-named actions apart', async () => {
		// The id is unique per adapter, not across them: the owning adapter stamps it.
		const owner = cardAction('wall-delete', 'layout', 'This deletes Wall wall-a.');
		const probe = cardAction('wall-delete', 'layout-probe', 'This retires the probe copy of Wall wall-a.');
		const target = mountCard({ actions: () => [owner, probe] });
		expect(controls(target)).toHaveLength(2);

		await press(target, 0);
		expect(target.textContent).toContain(owner.detail);
		expect(controls(target)[1]!.textContent).not.toContain('Confirm');
		await press(target, 1);
		expect(target.textContent).toContain(probe.detail);
		expect(owner.run).not.toHaveBeenCalled();
		expect(probe.run).not.toHaveBeenCalled();
	});

	it('drops the disclosure when the selected subject changes', async () => {
		const remove = cardAction('wall-delete', 'layout', 'This deletes Wall wall-a.');
		const identity = reactiveCell({
			sourceId: 'wall-a',
			label: 'Wall A',
			kind: 'wall',
			status: 'accepted'
		});
		const target = mountCard({ identity: () => identity.value, actions: () => [remove] });

		await press(target, 0);
		expect(controls(target)[0]!.textContent).toContain('Confirm');

		identity.value = { sourceId: 'wall-b', label: 'Wall B', kind: 'wall', status: 'accepted' };
		await tick();
		expect(controls(target)[0]!.textContent).not.toContain('Confirm');
		await press(target, 0);
		expect(remove.run).not.toHaveBeenCalled();
	});

	it('drops the disclosure when the owning adapter words the action differently', async () => {
		const remove = cardAction('wall-delete', 'layout', 'This deletes Wall wall-a.');
		const actions = reactiveCell<readonly StageCardActionRecord[]>([remove]);
		const target = mountCard({ actions: () => actions.value });

		await press(target, 0);
		expect(controls(target)[0]!.textContent).toContain('Confirm');

		// Same action, same adapter, consequences the creator has not read.
		actions.value = [{ ...remove, detail: 'This deletes Wall wall-a and 1 hosted Opening.' }];
		await tick();
		expect(controls(target)[0]!.textContent).not.toContain('Confirm');
		await press(target, 0);
		expect(remove.run).not.toHaveBeenCalled();
	});
});
