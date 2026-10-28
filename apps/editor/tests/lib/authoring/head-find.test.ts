// @vitest-environment jsdom
/**
 * PLATE Head — the **bounded Find** access (Round 2 D10, T1.P02.S02).
 *
 * The dock arms the tools a session starts with, but a creator still has to be
 * able to *discover* what is contributed and reach a migrated operation without a
 * pointer. That is what Find in the Head is, and this suite pins its bounds:
 *
 * 1. **Additive with a default.** A host that supplies no `find` gets the Head it
 *    had before — no empty search box, no second command surface;
 * 2. **Explicit verbs.** Each result carries the verb that reaches it (`Arm` a
 *    dock tool, `Invoke` an Index operation), and running it hands the entry back
 *    to the host — the Head runs no domain command of its own;
 * 3. **Bounded.** It lists exactly the entries the host supplied: it is not the
 *    scope-model Index, a subject search or every future Find command.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';

/** The entry shape the host supplies; the Head is structurally typed for it. */
type FindEntry = {
	readonly id: string;
	readonly adapterId: string;
	readonly label: string;
	readonly verb: string;
};

type FindProps = {
	readonly query: string;
	readonly entries: readonly FindEntry[];
	readonly onQuery: (value: string) => void;
	/** The Head hands back the entry it rendered, verb included. */
	readonly onRun: (entry: FindEntry) => void;
};

let component: ReturnType<typeof mount> | undefined;
let target: HTMLElement;

afterEach(() => {
	if (component !== undefined) unmount(component);
	component = undefined;
	target.remove();
});

function head(find: FindProps | null) {
	target = document.createElement('div');
	document.body.append(target);
	component = mount(EditorHead, {
		target,
		props: {
			projectId: 'project-1',
			projectName: 'Find fixture',
			lens: 'world' as const,
			onLens: () => {},
			canDownloadSource: true,
			onDownloadSource: () => {},
			historyUnavailableReason: 'Nothing to undo yet — no change has been accepted.',
			saveUnavailableReason: 'Conditional Save needs the cloud client; this session has none.',
			previewUnavailableReason: 'Preview needs an admitted project source.',
			reducedMotion: false,
			onToggleReducedMotion: () => {},
			find
		}
	});
	return target;
}

const ENTRIES: readonly FindEntry[] = [
	{ id: 'layout-ink', adapterId: 'layout', label: 'Ink · Wall', verb: 'Arm' },
	{ id: 'layout-place-plinth', adapterId: 'layout', label: 'Place plinth', verb: 'Invoke' }
];

describe('Head Find', () => {
	it('renders nothing at all when the host contributes no Find', () => {
		const host = head(null);
		expect(host.querySelector('[data-head-find]')).toBeNull();
		// The rest of the Head is untouched: this is an additive surface.
		expect(host.querySelector('[data-editor-history]')).not.toBeNull();
	});

	it('lists the supplied entries with the verb that reaches each one', async () => {
		const onRun = vi.fn();
		const host = head({ query: '', entries: ENTRIES, onQuery: () => {}, onRun });
		await tick();
		const find = host.querySelector<HTMLDetailsElement>('[data-head-find]')!;
		find.querySelector('summary')!.click();
		await tick();
		const results = [...find.querySelectorAll<HTMLButtonElement>('.find-results button')];
		expect(results.map((node) => node.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
			'Arm Ink · Wall',
			'Invoke Place plinth'
		]);

		results[0]!.click();
		expect(onRun).toHaveBeenCalledWith(ENTRIES[0]);
		expect(onRun).toHaveBeenCalledTimes(1);
	});

	it('reports its query to the host and says so when nothing matches', async () => {
		const onQuery = vi.fn();
		const host = head({ query: '', entries: [], onQuery, onRun: () => {} });
		await tick();
		const find = host.querySelector<HTMLDetailsElement>('[data-head-find]')!;
		find.querySelector('summary')!.click();
		await tick();
		expect(find.querySelector('.find-empty')?.textContent).toContain('No subject, tool or operation matches');

		const input = find.querySelector<HTMLInputElement>('input')!;
		input.value = 'ink';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onQuery).toHaveBeenCalledWith('ink');
	});
});
