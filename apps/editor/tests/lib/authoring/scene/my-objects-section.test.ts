// @vitest-environment jsdom
/**
 * T5.P01.S04 — the My Objects panel.
 *
 * The panel is a reader and caller: it lists, reads, verifies and arms. These pin
 * the behaviours a creator depends on:
 *
 * - the list loads only when the section opens;
 * - an item from another development format stays listed and removable but has no
 *   Insert;
 * - Insert reads and evaluates the source, then arms a copy for the Place
 *   session with the source's own contact;
 * - Remove asks once, then clears an armed copy and leaves other items alone;
 * - a read failure shows words and arms nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';

import {
	canonicalFormLibraryPayload,
	formLibraryContentId,
	type FormLibraryItemSummary,
	type FormLibraryPayload
} from '@portfolio/project-model/library';

import MyObjectsSection from '$lib/authoring/adapters/scene/library/MyObjectsSection.svelte';
import MyObjectsSectionLazy from '$lib/authoring/adapters/scene/library/MyObjectsSectionLazy.svelte';
import type { FormLibraryClient } from '$lib/authoring/adapters/scene/library/client';

const USABLE_ID = '11111111-1111-4111-8111-111111111111';
const OLDER_ID = '22222222-2222-4222-8222-222222222222';

function payload(name = 'Saved plinth', scale: [number, number, number] = [1, 1, 1]): FormLibraryPayload {
	return canonicalFormLibraryPayload({
		formatVersion: 1,
		kind: 'form',
		name,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1, v: 0, smooth: false },
					{ key: 3, u: 1, v: 0.5, smooth: false },
					{ key: 4, u: 0, v: 0.5, smooth: false }
				],
				extent: 0.4
			},
			scale,
			nextKey: 5
		},
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: true
	});
}

const usable = payload('Saved plinth', [1, 1.5, 1]);
const older = payload('Older plinth');

const summaries: FormLibraryItemSummary[] = [
	{
		id: USABLE_ID,
		name: 'Saved plinth',
		kind: 'form',
		formatVersion: 1,
		contentId: `sha256-${'a'.repeat(64)}`,
		createdAt: '2026-10-28T12:00:00.000Z'
	},
	{
		id: OLDER_ID,
		name: 'Older plinth',
		kind: 'form',
		formatVersion: 2,
		contentId: `sha256-${'b'.repeat(64)}`,
		createdAt: '2026-10-27T12:00:00.000Z'
	}
];

type Client = FormLibraryClient & {
	list: ReturnType<typeof vi.fn>;
	read: ReturnType<typeof vi.fn>;
	remove: ReturnType<typeof vi.fn>;
};

function client(overrides: Partial<Client> = {}): Client {
	return {
		list: vi.fn(async () => summaries),
		read: vi.fn(async (item: Pick<FormLibraryItemSummary, 'id'>) => {
			if (item.id === OLDER_ID) throw new Error('an older item must not be read for insertion');
			return { payload: usable, contentId: `sha256-${'a'.repeat(64)}` };
		}),
		save: vi.fn(),
		remove: vi.fn(async () => undefined),
		...overrides
	} as Client;
}

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

async function mountPanel(options: {
	client?: Client;
	hasRoomFloor?: boolean;
	armedCopy?: { itemId: string; item: FormLibraryPayload; contactMinY: number } | null;
	onArm?: ReturnType<typeof vi.fn>;
	onClear?: ReturnType<typeof vi.fn>;
} = {}): Promise<{
	target: HTMLElement;
	onArm: ReturnType<typeof vi.fn>;
	onClear: ReturnType<typeof vi.fn>;
}> {
	const onArm = options.onArm ?? vi.fn(() => true);
	const onClear = options.onClear ?? vi.fn();
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(MyObjectsSection, {
		target,
		props: {
			client: options.client ?? client(),
			hasRoomFloor: options.hasRoomFloor ?? true,
			armedCopy: options.armedCopy ?? null,
			onArm,
			onClear
		}
	});
	cleanup = () => {
		void unmount(component);
	};
	await tick();
	return { target, onArm, onClear };
}

async function open(target: HTMLElement): Promise<void> {
	target.querySelector<HTMLButtonElement>('[data-my-objects-toggle]')!.click();
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 10));
	await tick();
}

describe('My Objects panel', () => {
	it('opens the production lazy wrapper with one press and loads the list', async () => {
		const mock = client();
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(MyObjectsSectionLazy, {
			target,
			props: { client: mock, onArm: vi.fn(() => true), onClear: vi.fn() }
		});
		cleanup = () => {
			void unmount(component);
		};
		await tick();
		const toggle = target.querySelector<HTMLButtonElement>('[data-my-objects-toggle]')!;
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(mock.list).not.toHaveBeenCalled();
		toggle.click();
		await tick();
		// The wrapper downloads and mounts the section, which loads its list.
		for (let attempt = 0; attempt < 50 && mock.list.mock.calls.length === 0; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 10));
			await tick();
		}
		expect(mock.list).toHaveBeenCalledTimes(1);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(target.querySelector(`[data-my-objects-item="${USABLE_ID}"]`)).not.toBeNull();
	});

	it('loads lazily and lists usable and older items with the right affordances', async () => {
		const mock = client();
		const { target } = await mountPanel({ client: mock });
		expect(mock.list).not.toHaveBeenCalled();
		await open(target);
		expect(mock.list).toHaveBeenCalledTimes(1);

		const usableRow = target.querySelector<HTMLElement>(`[data-my-objects-item="${USABLE_ID}"]`)!;
		expect(usableRow.querySelector('[data-my-objects-insert]')).not.toBeNull();
		expect(usableRow.querySelector('[data-my-objects-footprint]')).not.toBeNull();

		const olderRow = target.querySelector<HTMLElement>(`[data-my-objects-item="${OLDER_ID}"]`)!;
		expect(olderRow.textContent).toContain('earlier development version');
		expect(olderRow.querySelector('[data-my-objects-insert]')).toBeNull();
		expect(olderRow.querySelector('[data-my-objects-remove]')).not.toBeNull();
	});

	it('inserts by reading and evaluating the source, then arms it with its own contact', async () => {
		const mock = client();
		const { target, onArm } = await mountPanel({
			client: mock,
			// The parent reflects the arm back; the panel only says “ready” for the
			// item the live session still holds.
			armedCopy: { itemId: USABLE_ID, item: usable, contactMinY: 0 }
		});
		await open(target);
		target.querySelector<HTMLButtonElement>('[data-my-objects-insert]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(mock.read).toHaveBeenCalledWith(summaries[0]);
		expect(onArm).toHaveBeenCalledTimes(1);
		const armed = onArm.mock.calls[0]?.[0];
		expect(armed.itemId).toBe(USABLE_ID);
		expect(armed.item).toEqual(usable);
		expect(armed.contactMinY).toBe(0);
		expect(target.textContent).toContain('is ready: click its floor position');
	});

	it('never says a copy is ready when the live session no longer holds that arm', async () => {
		const mock = client();
		const { target, onArm } = await mountPanel({ client: mock });
		await open(target);
		target.querySelector<HTMLButtonElement>('[data-my-objects-insert]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(onArm).toHaveBeenCalledTimes(1);
		// The parent cleared or never installed the arm (a typed commit, a primitive
		// choice, a reading change or no live session), so the panel must not claim
		// the next click places the copy.
		expect(target.textContent).not.toContain('is ready: click its floor position');
	});

	it('reports a refused arm instead of claiming the copy is ready', async () => {
		const mock = client();
		const onArm = vi.fn(() => false);
		const { target } = await mountPanel({ client: mock, onArm });
		await open(target);
		target.querySelector<HTMLButtonElement>('[data-my-objects-insert]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(onArm).toHaveBeenCalledTimes(1);
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('was not armed');
		expect(target.textContent).not.toContain('is ready: click its floor position');
	});

	it('derives a footprint silhouette only on demand', async () => {
		const { target } = await mountPanel();
		await open(target);
		const row = target.querySelector<HTMLElement>(`[data-my-objects-item="${USABLE_ID}"]`)!;
		expect(row.querySelector('svg')).toBeNull();
		row.querySelector<HTMLButtonElement>('[data-my-objects-footprint]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(row.querySelector('svg polygon')).not.toBeNull();
		expect(row.textContent).toContain('1.000 × 0.500 m');
	});

	it('confirms Remove, clears an armed copy and leaves the arm of another item', async () => {
		const mock = client();
		const { target, onClear } = await mountPanel({
			client: mock,
			armedCopy: { itemId: OLDER_ID, item: older, contactMinY: 0 }
		});
		await open(target);
		const row = target.querySelector<HTMLElement>(`[data-my-objects-item="${USABLE_ID}"]`)!;
		const remove = row.querySelector<HTMLButtonElement>('[data-my-objects-remove]')!;
		remove.click();
		await tick();
		expect(mock.remove).not.toHaveBeenCalled();
		expect(remove.textContent).toContain('Confirm remove');
		remove.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(mock.remove).toHaveBeenCalledWith(USABLE_ID);
		expect(onClear).not.toHaveBeenCalled();
		expect(target.textContent).toContain('Removed Saved plinth');

		const olderRow = target.querySelector<HTMLElement>(`[data-my-objects-item="${OLDER_ID}"]`)!;
		olderRow.querySelector<HTMLButtonElement>('[data-my-objects-remove]')!.click();
		await tick();
		olderRow.querySelector<HTMLButtonElement>('[data-my-objects-remove]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it('shows a read refusal and arms nothing', async () => {
		const mock = client({
			read: vi.fn(async () => {
				throw new Error('that item cannot be read');
			})
		});
		const { target, onArm } = await mountPanel({ client: mock });
		await open(target);
		target.querySelector<HTMLButtonElement>('[data-my-objects-insert]')!.click();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(target.querySelector('[role="alert"]')?.textContent).toContain(
			'My Objects could not be reached'
		);
		expect(onArm).not.toHaveBeenCalled();
	});

	it('refuses Insert without a Room floor and says why', async () => {
		const { target, onArm } = await mountPanel({ hasRoomFloor: false });
		await open(target);
		const insert = target.querySelector<HTMLButtonElement>('[data-my-objects-insert]')!;
		expect(insert.disabled).toBe(true);
		expect(target.textContent).toContain('No Room floor yet');
		expect(onArm).not.toHaveBeenCalled();
	});
});
