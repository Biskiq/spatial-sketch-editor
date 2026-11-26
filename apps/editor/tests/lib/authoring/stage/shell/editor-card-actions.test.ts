// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
import { mountWithProps } from '../../../../kit/dom';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('Card actions by subject', () => {
	function mountCard(options: { functions?: readonly string[] | null; onBringIntoView?: (() => void) | null; kind?: string }) {
		const mounted = mountWithProps(EditorCard, {
			identity: {
				sourceId: 'experience:presentation:presentation-1',
				label: 'Entry hall',
				kind: options.kind ?? 'Presentation',
				status: 'Default View set'
			},
			facts: [{ label: 'Views', value: '2' }],
			writer: null,
			actions: [],
			nameWriter: null,
			onClose: () => {},
			functions: options.functions ?? null,
			onBringIntoView: options.onBringIntoView ?? null
		});
		cleanup = mounted.unmount;
		return mounted.target;
	}

	it('shows neither the `•••` menu nor Bring into view for a Presentation that has no functions', () => {
		const target = mountCard({ functions: [] });
		expect(target.querySelector('[aria-label="Subject actions"]')).toBeNull();
		expect(target.querySelector('[aria-label="Bring into view"]')).toBeNull();
		expect(target.querySelector('h2.name')?.textContent).toContain('Entry hall');
		expect(target.querySelector('.kind')?.textContent).toBe('Presentation');
	});

	it('keeps the World subject: its object functions and Bring into view stay as they were', () => {
		const onBringIntoView = vi.fn();
		const target = mountCard({ functions: null, onBringIntoView, kind: 'Wall' });
		expect(target.querySelector('[aria-label="Subject actions"]')).not.toBeNull();
		const bring = target.querySelector<HTMLButtonElement>('[aria-label="Bring into view"]');
		expect(bring).not.toBeNull();
		bring!.click();
		expect(onBringIntoView).toHaveBeenCalledOnce();
	});
});
