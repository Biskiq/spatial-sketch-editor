// @vitest-environment jsdom
/**
 * R217.S26 — the Card chrome the Experience structure and removal use.
 *
 * Danger items sit at the end of `•••` after a rule, in red; choosing one opens a
 * consequence block **in place in the Card** (not a modal) with its effect lines, a red
 * Remove and Cancel. Esc cancels and focus returns to `•••`. A choice the removal needs
 * (the new Default) keeps Remove disabled until made. A refused item stays disabled with
 * its reason as its hint. A submenu (Add to Guide ▸) opens in place. The kind line can
 * carry *‹ Back*, and the Experience rename fields commit on Enter or blur.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount, type ComponentProps } from 'svelte';
import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';

type Props = ComponentProps<typeof EditorCard>;
type Item = NonNullable<Props['menu']>[number];

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

function mountCard(props: Partial<Props>): HTMLElement {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditorCard, {
		target,
		props: {
			identity: { sourceId: 'experience:stop:stop-2', label: 'Gallery', kind: 'Stop 2 of 6 · Salon tour', status: '' },
			facts: [],
			onClose: () => {},
			onBringIntoView: null,
			...props
		}
	});
	cleanup = () => void unmount(component);
	flushSync();
	return target;
}

function openMenu(target: HTMLElement): HTMLButtonElement {
	const trigger = target.querySelector<HTMLButtonElement>('[aria-label="Subject actions"]')!;
	flushSync(() => trigger.click());
	return trigger;
}

function removal(run = vi.fn(), options: { readonly choose?: boolean; readonly refused?: string } = {}): Item {
	return {
		id: 'remove-stop',
		label: 'Remove Stop',
		danger: true,
		...(options.refused === undefined ? {} : { disabled: true, reason: options.refused }),
		consequence: {
			read: (choice) =>
				options.choose === true
					? {
							kind: 'ready',
							lines: ['Removes Hall from Piano.', choice === null ? 'Choose the new Default.' : `${choice} becomes the Default View.`],
							choose: { label: 'New Default View', options: [{ id: 'keys', label: 'Keys' }, { id: 'wide', label: 'Wide' }] },
							runnable: choice !== null
						}
					: { kind: 'ready', lines: ['Removes Stop 2. Gallery stays.', 'Stop 1 follows the Guide order.'], choose: null, runnable: true },
			run
		}
	};
}

describe('R217.S26 — danger items and the consequence block', () => {
	it('puts danger items last after a rule, and opens the block in place rather than running', async () => {
		const run = vi.fn();
		const move = vi.fn();
		const target = mountCard({ menu: [removal(run), { id: 'move-later', label: 'Move later', run: move }] });
		openMenu(target);
		const panel = target.querySelector('[data-card-actions]')!;
		const children = [...panel.children].map((child) => child.tagName === 'HR' ? 'hr' : child.getAttribute('data-card-menu'));
		expect(children).toEqual(['move-later', 'hr', 'remove-stop']);
		const danger = panel.querySelector<HTMLButtonElement>('[data-card-menu="remove-stop"]')!;
		expect(danger.classList.contains('danger')).toBe(true);

		flushSync(() => danger.click());
		await tick();
		expect(run).not.toHaveBeenCalled();
		expect(target.querySelector('[data-card-actions]')).toBeNull();
		const block = target.querySelector<HTMLElement>('[data-card-consequence="remove-stop"]')!;
		expect(block.closest('aside.card')).not.toBeNull();
		expect(target.querySelector('[role="dialog"], [role="alertdialog"]')).toBeNull();
		expect([...block.querySelectorAll('.consequence-line')].map((line) => line.textContent)).toEqual([
			'Removes Stop 2. Gallery stays.',
			'Stop 1 follows the Guide order.'
		]);
		flushSync(() => block.querySelector<HTMLButtonElement>('[data-card-consequence-run]')!.click());
		await tick();
		await tick();
		expect(run).toHaveBeenCalledWith(null);
		expect(target.querySelector('[data-card-consequence]')).toBeNull();
	});

	it('cancels on Esc with no run, returning focus to •••', async () => {
		const run = vi.fn();
		const target = mountCard({ menu: [removal(run)] });
		const trigger = openMenu(target);
		flushSync(() => target.querySelector<HTMLButtonElement>('[data-card-menu="remove-stop"]')!.click());
		const block = target.querySelector<HTMLElement>('[data-card-consequence]')!;
		expect(block.contains(document.activeElement)).toBe(true);
		flushSync(() => block.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
		await tick();
		expect(target.querySelector('[data-card-consequence]')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		expect(run).not.toHaveBeenCalled();
	});

	it('keeps Remove disabled until the new Default is chosen, then runs with that choice', async () => {
		const run = vi.fn();
		const target = mountCard({ menu: [removal(run, { choose: true })] });
		openMenu(target);
		flushSync(() => target.querySelector<HTMLButtonElement>('[data-card-menu="remove-stop"]')!.click());
		const remove = () => target.querySelector<HTMLButtonElement>('[data-card-consequence-run]')!;
		expect(remove().disabled).toBe(true);
		const radios = [...target.querySelectorAll<HTMLInputElement>('[data-card-consequence] input[type="radio"]')];
		expect(radios.map((radio) => radio.checked)).toEqual([false, false]);
		flushSync(() => {
			radios[1]!.checked = true;
			radios[1]!.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(remove().disabled).toBe(false);
		expect(target.querySelector('[data-card-consequence]')!.textContent).toContain('wide becomes the Default View.');
		flushSync(() => remove().click());
		await tick();
		expect(run).toHaveBeenCalledWith('wide');
	});

	it('keeps a refused danger item disabled with its reason as its visible hint', () => {
		const target = mountCard({ menu: [removal(vi.fn(), { refused: 'A Guide keeps at least one Stop — remove the Guide instead' })] });
		openMenu(target);
		const item = target.querySelector<HTMLButtonElement>('[data-card-menu="remove-stop"]')!;
		expect(item.disabled).toBe(true);
		expect(item.title).toBe('A Guide keeps at least one Stop — remove the Guide instead');
		expect(item.querySelector('.hint')?.textContent).toBe('A Guide keeps at least one Stop — remove the Guide instead');
	});
});

describe('R217.S26 — submenu, Back and rename', () => {
	it('opens Add to Guide ▸ in place; a child runs and closes the menu', () => {
		const add = vi.fn();
		const target = mountCard({
			menu: [
				{
					id: 'add-to-guide',
					label: 'Add to Guide',
					children: [
						{ id: 'add-to-guide:tour', label: 'Salon tour', hint: 'again', run: add },
						{ id: 'new-guide', label: 'New Guide…', run: vi.fn() }
					]
				}
			]
		});
		openMenu(target);
		const parent = target.querySelector<HTMLButtonElement>('[data-card-menu="add-to-guide"]')!;
		expect(parent.getAttribute('aria-expanded')).toBe('false');
		flushSync(() => parent.click());
		expect(parent.getAttribute('aria-expanded')).toBe('true');
		const child = target.querySelector<HTMLButtonElement>('[data-card-submenu] [data-card-menu="add-to-guide:tour"]')!;
		expect(child.querySelector('.hint')?.textContent).toBe('again');
		flushSync(() => child.click());
		expect(add).toHaveBeenCalledTimes(1);
		expect(target.querySelector('[data-card-actions]')).toBeNull();
	});

	it('shows ‹ Back before the kind and runs it on press', () => {
		const onBack = vi.fn();
		const target = mountCard({ back: { label: 'Stop 2', onBack } });
		const back = target.querySelector<HTMLButtonElement>('.kind [data-card-back]')!;
		expect(back.textContent).toBe('‹ Stop 2');
		expect(back.getAttribute('aria-label')).toBe('Back to Stop 2');
		back.click();
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('commits an Experience rename on blur, refuses an empty one, and Esc commits nothing', async () => {
		const commit = vi.fn(async () => ({ kind: 'accepted' as const }));
		const target = mountCard({ nameWriter: { value: 'Gallery', commit, commitOnBlur: true, emptyMessage: 'A name is needed' } });
		const title = () => target.querySelector<HTMLButtonElement>('.name button')!;
		const input = () => target.querySelector<HTMLInputElement>('.rename-input')!;
		const type = (value: string) => flushSync(() => {
			input().value = value;
			input().dispatchEvent(new Event('input', { bubbles: true }));
		});

		flushSync(() => title().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
		type('');
		flushSync(() => input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
		expect(target.querySelector('.error')?.textContent).toBe('A name is needed');

		flushSync(() => input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
		expect(commit).not.toHaveBeenCalled();

		flushSync(() => title().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
		type('Long gallery');
		flushSync(() => input().dispatchEvent(new FocusEvent('blur')));
		await tick();
		expect(commit).toHaveBeenCalledWith('Long gallery');
	});
});
