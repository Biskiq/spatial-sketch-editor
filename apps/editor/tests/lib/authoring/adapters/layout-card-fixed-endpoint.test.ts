// @vitest-environment jsdom
/**
 * A7.2 — the Card's explicit fixed-end choice on Wall Length.
 *
 * The choice is editor-local: it sets the controller's anchor for the next exact
 * Length solve and submits nothing. This suite is the call-site proof — the
 * mounted Card renders the control only where an editable Length exists,
 * defaults to the controller's Start, follows a rebuilt controller, and never
 * commits or edits while the creator switches it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';

import LayoutCardFields from '$lib/authoring/adapters/layout/LayoutCardFields.svelte';
import { createCardFieldsInstrument } from '$lib/authoring/adapters/layout/adapter-support';
import type { LayoutFieldState, LayoutInstrument } from '$lib/authoring/adapters/layout/instrument';
import type { FixedWallEndpoint } from '@portfolio/layout-core/wall';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { reactiveCell } from '../__fixtures__/reactive-cell.svelte.ts';

vi.mock('$lib/authoring/adapters/layout/adapter-support', () => ({ createCardFieldsInstrument: vi.fn() }));

type Subject = { readonly kind: 'wall' | 'opening'; readonly id: string };

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

function field(id: string, label: string, value = '6'): LayoutFieldState {
	return { id, label, unit: 'm', value, text: value, error: null };
}

function servicesFor(subject: Subject): StageAdapterServices {
	// A narrow fake stage: the Opening card's Repeat panel reads a snapshot, so
	// the fake answers with an empty accepted layout rather than real geometry.
	const snapshot = {
		sourceContentId: 'layout-card-fixed-end',
		domain: {
			datumMeters: 0,
			unitRevisions: { layout: 'layout-card-fixed-end' },
			geometry: { walls: [], openings: [], rooms: [] }
		}
	};
	return {
		stage: {
			selection: () => ({ sourceKind: subject.kind, sourceId: subject.id }),
			snapshot: () => snapshot
		}
	} as unknown as StageAdapterServices;
}

function writer(subject: Subject, fields: readonly LayoutFieldState[], endpoint: FixedWallEndpoint = 'start') {
	let fixed = endpoint;
	const setFixedEndpoint = vi.fn((next: FixedWallEndpoint) => {
		fixed = next;
	});
	const commit = vi.fn();
	const edit = vi.fn();
	const instrument = {
		subject: { kind: subject.kind, id: subject.id },
		facts: () => [],
		fields: () => fields,
		fixedEndpoint: () => fixed,
		setFixedEndpoint,
		pausedProposal: () => null,
		edit,
		commit,
		cancel: vi.fn(),
		blur: vi.fn(),
		resumePaused: vi.fn(),
		discardPaused: vi.fn(),
		dispose: vi.fn()
	} as unknown as LayoutInstrument;
	return { instrument, setFixedEndpoint, commit, edit };
}

async function panel(subject: Subject, active: ReturnType<typeof writer>) {
	vi.mocked(createCardFieldsInstrument).mockReturnValue(active.instrument);
	const cell = reactiveCell(servicesFor(subject));
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(LayoutCardFields, {
		target,
		props: {
			get services() {
				return cell.value;
			}
		}
	});
	cleanup = () => {
		cleanup = undefined;
		void unmount(component);
	};
	await tick();
	return { target, cell };
}

function option(target: HTMLElement, endpoint: FixedWallEndpoint): HTMLButtonElement | null {
	return target.querySelector<HTMLButtonElement>(`[data-fixed-end="${endpoint}"]`);
}

describe('Card fixed end for Wall Length', () => {
	it('offers Start and End beside Length, starts on Start, and switching submits nothing', async () => {
		const active = writer({ kind: 'wall', id: 'wall-a' }, [field('length', 'Length'), field('height', 'Height', '2.7')]);
		const { target } = await panel({ kind: 'wall', id: 'wall-a' }, active);
		const group = target.querySelector('[data-layout-fixed-end]');
		expect(group?.getAttribute('role')).toBe('group');
		expect(group?.getAttribute('aria-label')).toBe('Length keeps fixed');
		expect(option(target, 'start')?.textContent).toBe('Start');
		expect(option(target, 'end')?.textContent).toBe('End');
		expect(option(target, 'start')?.getAttribute('aria-pressed')).toBe('true');
		expect(option(target, 'end')?.getAttribute('aria-pressed')).toBe('false');
		expect(active.setFixedEndpoint).not.toHaveBeenCalled();

		option(target, 'end')!.click();
		await tick();
		expect(active.setFixedEndpoint).toHaveBeenCalledWith('end');
		expect(option(target, 'end')?.getAttribute('aria-pressed')).toBe('true');
		expect(option(target, 'start')?.getAttribute('aria-pressed')).toBe('false');
		// Switching the anchor is not an edit: no draft, no commit, no lease.
		expect(active.commit).not.toHaveBeenCalled();
		expect(active.edit).not.toHaveBeenCalled();
	});

	it.each([
		['a closed Wall', { kind: 'wall', id: 'wall-closed' } as Subject, [field('radius', 'Radius', '2'), field('diameter', 'Diameter', '4'), field('height', 'Height', '2.7')]],
		['a curved Wall', { kind: 'wall', id: 'wall-curved' } as Subject, [field('height', 'Height', '2.7'), field('thickness', 'Thickness', '0.2')]],
		['an Opening', { kind: 'opening', id: 'opening-a' } as Subject, [field('width', 'Width', '1.2'), field('height', 'Height', '1.1')]]
	] as const)('does not offer the choice on %s, which has no editable Length', async (_name, subject, fields) => {
		const active = writer(subject, fields);
		const { target } = await panel(subject, active);
		expect(target.querySelector('[data-layout-fixed-end]')).toBeNull();
		expect(target.querySelector('[data-fixed-end]')).toBeNull();
	});

	it('carries the chosen anchor across an accepted rebuild of the same Wall', async () => {
		const first = writer({ kind: 'wall', id: 'wall-a' }, [field('length', 'Length')]);
		const second = writer({ kind: 'wall', id: 'wall-a' }, [field('length', 'Length', '5')]);
		vi.mocked(createCardFieldsInstrument)
			.mockReturnValueOnce(first.instrument)
			.mockReturnValue(second.instrument);
		const cell = reactiveCell(servicesFor({ kind: 'wall', id: 'wall-a' }));
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutCardFields, {
			target,
			props: {
				get services() {
					return cell.value;
				}
			}
		});
		cleanup = () => {
			cleanup = undefined;
			void unmount(component);
		};
		await tick();
		option(target, 'end')!.click();
		await tick();
		expect(option(target, 'end')?.getAttribute('aria-pressed')).toBe('true');

		// The accepted source installs a fresh controller for the same Wall.
		cell.value = servicesFor({ kind: 'wall', id: 'wall-a' });
		await tick();
		expect(second.setFixedEndpoint).toHaveBeenCalledWith('end');
		expect(option(target, 'end')?.getAttribute('aria-pressed')).toBe('true');
		expect(option(target, 'start')?.getAttribute('aria-pressed')).toBe('false');
	});

	it('follows a new subject back to Start instead of keeping a stale choice', async () => {
		const first = writer({ kind: 'wall', id: 'wall-a' }, [field('length', 'Length')], 'end');
		const second = writer({ kind: 'wall', id: 'wall-b' }, [field('length', 'Length')], 'start');
		vi.mocked(createCardFieldsInstrument).mockImplementation((services) =>
			services.stage.selection()?.sourceId === 'wall-a' ? first.instrument : second.instrument
		);
		const cell = reactiveCell(servicesFor({ kind: 'wall', id: 'wall-a' }));
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutCardFields, {
			target,
			props: {
				get services() {
					return cell.value;
				}
			}
		});
		cleanup = () => {
			cleanup = undefined;
			void unmount(component);
		};
		await tick();
		expect(option(target, 'end')?.getAttribute('aria-pressed')).toBe('true');

		cell.value = servicesFor({ kind: 'wall', id: 'wall-b' });
		await tick();
		expect(option(target, 'start')?.getAttribute('aria-pressed')).toBe('true');
		expect(option(target, 'end')?.getAttribute('aria-pressed')).toBe('false');
	});
});
