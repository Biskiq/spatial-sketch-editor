// @vitest-environment jsdom
/**
 * R217.S15 — the Card's non-pointer path for Wall direct manipulation.
 *
 * Start and End X/Z are one disclosed group, not four more always-open rows:
 * the grammar requires each precision operation to have a Card writer, and the
 * disclosure keeps the ordinary Wall measures readable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';

import LayoutCardFields from '$lib/authoring/adapters/layout/LayoutCardFields.svelte';
import { createCardFieldsInstrument } from '$lib/authoring/adapters/layout/adapter-support';
import type { LayoutFieldState, LayoutInstrument } from '$lib/authoring/adapters/layout/instrument';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

vi.mock('$lib/authoring/adapters/layout/adapter-support', () => ({ createCardFieldsInstrument: vi.fn() }));

const fields: readonly LayoutFieldState[] = [
	{ id: 'length', label: 'Length', unit: 'm', value: '6', text: '6', error: null },
	{ id: 'startX', label: 'Start X', unit: 'm', value: '0', text: '0', error: null },
	{ id: 'startZ', label: 'Start Z', unit: 'm', value: '0', text: '0', error: null },
	{ id: 'endX', label: 'End X', unit: 'm', value: '6', text: '6', error: null },
	{ id: 'endZ', label: 'End Z', unit: 'm', value: '0', text: '0', error: null }
];

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe('R217.S15 — Card Junction fields', () => {
	it('puts Start and End X/Z in one disclosure and keeps ordinary fields outside it', async () => {
		const controller = {
			subject: { kind: 'wall', id: 'wall-a' },
			facts: () => [],
			fields: () => fields,
			fixedEndpoint: () => 'start',
			setFixedEndpoint: vi.fn(),
			pausedProposal: () => null,
			edit: vi.fn(),
			commit: vi.fn(),
			cancel: vi.fn(),
			blur: vi.fn(),
			resumePaused: vi.fn(),
			discardPaused: vi.fn(),
			dispose: vi.fn()
		} as unknown as LayoutInstrument;
		vi.mocked(createCardFieldsInstrument).mockReturnValue(controller);

		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(LayoutCardFields, {
			target,
			props: {
				services: {
					stage: { selection: () => ({ sourceKind: 'wall', sourceId: 'wall-a' }) }
				} as unknown as StageAdapterServices
			}
		});
		cleanup = () => { void unmount(component); };
		await tick();

		const details = target.querySelector<HTMLDetailsElement>('details[data-layout-junction-fields]');
		expect(details).not.toBeNull();
		expect(details!.querySelector('summary')?.textContent).toContain('Start and End X/Z');
		expect([...details!.querySelectorAll<HTMLInputElement>('input[data-field]')].map((input) => input.dataset.field)).toEqual([
			'startX',
			'startZ',
			'endX',
			'endZ'
		]);
		expect(target.querySelector('input[data-field="length"]')).not.toBeNull();
		expect(details!.contains(target.querySelector('input[data-field="length"]'))).toBe(false);
	});
});
