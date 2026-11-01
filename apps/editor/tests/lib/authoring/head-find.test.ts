// @vitest-environment jsdom
/**
 * PLATE Head — the **bounded Find** access (Round 2 D10, T1.P02.S02; R217.S20).
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
 * 4. **Former menu reachable (R217.S20).** Every capability the old ☰ menu held
 *    keeps a Find entry, and Keys does too. Rename and delete run the Head's own
 *    project procedure; every other entry goes to the host.
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

function head(
	find: FindProps | null,
	location?: { onOpenIndex: () => void },
	extra: Record<string, unknown> = {}
) {
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
			indexOpen: location === undefined,
			locationLabel: 'Selected wall',
			onOpenIndex: location?.onOpenIndex,
			find,
			...extra
		}
	});
	return target;
}

const ENTRIES: readonly FindEntry[] = [
	{ id: 'layout-ink', adapterId: 'layout', label: 'Ink · Wall', verb: 'Arm' },
	{ id: 'layout-place-plinth', adapterId: 'layout', label: 'Place plinth', verb: 'Invoke' }
];

/** Every capability the former ☰ menu held, and Keys, as the route supplies them. */
const FORMER_MENU: readonly FindEntry[] = [
	{ id: 'appearance:paper', adapterId: 'preference', label: '2D appearance: Paper', verb: 'Set' },
	{ id: 'appearance:shaded', adapterId: 'preference', label: '2D appearance: Shaded', verb: 'Set' },
	{ id: 'height-sheet:right', adapterId: 'preference', label: 'Height Sheet: Right', verb: 'Set' },
	{ id: 'height-sheet:left', adapterId: 'preference', label: 'Height Sheet: Left', verb: 'Set' },
	{ id: 'reduce-motion', adapterId: 'preference', label: 'Reduce motion', verb: 'Toggle' },
	{ id: 'motion-speed:slow', adapterId: 'preference', label: 'Motion speed: Slow', verb: 'Set' },
	{ id: 'motion-speed:normal', adapterId: 'preference', label: 'Motion speed: Normal', verb: 'Set' },
	{ id: 'motion-speed:fast', adapterId: 'preference', label: 'Motion speed: Fast', verb: 'Set' },
	{ id: 'keys', adapterId: 'keys', label: 'Keys', verb: 'Show' },
	{ id: 'rename', adapterId: 'project-menu', label: 'Rename project', verb: 'Run' },
	{ id: 'delete', adapterId: 'project-menu', label: 'Delete project', verb: 'Run' },
	{ id: 'download', adapterId: 'project-menu', label: 'Download source JSON', verb: 'Run' },
	{ id: 'source', adapterId: 'project-menu', label: 'Open source JSON', verb: 'Replace' }
];

describe('Head Find', () => {
	it('opens and focuses Find with the shortcut and reopens the Index from location', async () => {
		const onOpenIndex = vi.fn();
		const host = head({ query: '', entries: ENTRIES, onQuery: () => {}, onRun: () => {} }, { onOpenIndex });
		await tick();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
		const find = host.querySelector<HTMLDetailsElement>('[data-head-find]')!;
		expect(find.open).toBe(true);
		expect(document.activeElement).toBe(find.querySelector('input'));
		const location = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Selected wall'))!;
		location.click();
		expect(onOpenIndex).toHaveBeenCalledOnce();
	});
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

	it('reaches each former menu capability and Keys, each with its verb', async () => {
		const onRun = vi.fn();
		const host = head({ query: '', entries: FORMER_MENU, onQuery: () => {}, onRun });
		await tick();
		const find = host.querySelector<HTMLDetailsElement>('[data-head-find]')!;
		find.querySelector('summary')!.click();
		await tick();

		const rows = [...find.querySelectorAll<HTMLButtonElement>('[data-find-id]')];
		expect(rows.map((row) => `${row.dataset.findAdapter}:${row.dataset.findId}`)).toEqual(
			FORMER_MENU.map((entry) => `${entry.adapterId}:${entry.id}`)
		);
		expect(rows.find((row) => row.dataset.findId === 'keys')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Show Keys');
		expect(rows.find((row) => row.dataset.findId === 'source')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
			'Replace Open source JSON'
		);

		// Preferences, Keys and download/source are the host's to run, verb and all.
		for (const row of rows.filter((item) => item.dataset.findId !== 'rename' && item.dataset.findId !== 'delete')) row.click();
		expect(onRun.mock.calls.map((call) => call[0] as FindEntry)).toEqual(
			FORMER_MENU.filter((entry) => entry.id !== 'rename' && entry.id !== 'delete')
		);
	});

	it('runs Find rename and delete as the project procedure, never as a host command', async () => {
		const onRun = vi.fn();
		const onPrepareRename = vi.fn(async () => ({ kind: 'blocked' as const, message: 'Rename is unavailable in this fixture.' }));
		const onPrepareDelete = vi.fn(async () => ({ kind: 'blocked' as const, message: 'Delete is unavailable in this fixture.' }));
		const host = head({ query: '', entries: FORMER_MENU, onQuery: () => {}, onRun }, undefined, {
			onPrepareRename,
			onPrepareDelete
		});
		await tick();
		const find = host.querySelector<HTMLDetailsElement>('[data-head-find]')!;
		find.querySelector('summary')!.click();
		await tick();

		const rename = find.querySelector<HTMLButtonElement>('[data-find-id="rename"]')!;
		rename.click();
		await vi.waitFor(() => expect(onPrepareRename).toHaveBeenCalledOnce());
		// The project menu opens to hold the procedure, and the procedure reports its own status.
		expect(host.querySelector<HTMLElement>('[data-head-project-menu]')!.hidden).toBe(false);
		await vi.waitFor(() => expect(host.querySelector('.inline-message')?.textContent).toContain('Rename is unavailable'));

		find.querySelector('summary')!.click();
		await tick();
		find.querySelector<HTMLButtonElement>('[data-find-id="delete"]')!.click();
		await vi.waitFor(() => expect(onPrepareDelete).toHaveBeenCalledOnce());
		await vi.waitFor(() => expect(host.querySelector('.inline-message')?.textContent).toContain('Delete is unavailable'));

		expect(onRun).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'rename' }));
		expect(onRun).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'delete' }));
	});

	it('keeps the project actions and the project id in the project menu, under the name', async () => {
		const host = head(null);
		const menu = host.querySelector<HTMLElement>('[data-head-project-menu]')!;
		expect(menu.hidden).toBe(true);
		const name = host.querySelector<HTMLButtonElement>('[data-head-project]')!;
		expect(name.getAttribute('aria-expanded')).toBe('false');
		expect(name.textContent).toContain('Find fixture');
		name.click();
		await tick();
		expect(menu.hidden).toBe(false);
		expect(name.getAttribute('aria-expanded')).toBe('true');
		expect(menu.querySelector('[data-head-download]')).not.toBeNull();
		expect(menu.querySelector('[data-head-source]')).not.toBeNull();
		expect(menu.querySelector('code')?.textContent).toBe('project-1');
		expect(menu.textContent).toContain('Rename');
		expect(menu.textContent).toContain('Delete');
	});

	it('closes the project menu on Escape and returns focus to the project name', async () => {
		const host = head(null);
		const name = host.querySelector<HTMLButtonElement>('[data-head-project]')!;
		const menu = host.querySelector<HTMLElement>('[data-head-project-menu]')!;
		name.click();
		await tick();
		expect(menu.hidden).toBe(false);
		// Focus inside the open menu, as a keyboard user would have it.
		const download = menu.querySelector<HTMLButtonElement>('[data-head-download]')!;
		download.focus();
		download.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await tick();
		expect(menu.hidden).toBe(true);
		expect(name.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(name);
	});
});
