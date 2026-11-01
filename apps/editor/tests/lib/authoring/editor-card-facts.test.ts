// @vitest-environment jsdom
/**
 * R217.S21 — the Card states each fact once, styles only a destructive action as
 * destructive, and never lets a generated name reach a save.
 *
 * These mount the Card the way the route does: the header carries the name and the kind,
 * a contributed writer edits its fields in place, and every other fact is a read-only row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
import type { StageCardActionRecord, StageCardFact } from '$lib/authoring/stage/stage-facade';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

type Identity = { sourceId: string; label: string; kind: string; status: string };

function mountCard(options: {
	identity?: Identity;
	facts?: readonly StageCardFact[];
	writer?: { summary: string; adapterId: string; fieldIds?: readonly string[] } | null;
	actions?: readonly StageCardActionRecord[];
	technicalFacts?: readonly StageCardFact[];
	nameWriter?: {
		value: string;
		commit: (name: string) => Promise<{ kind: string; message?: string }>;
	} | null;
	onBringIntoView?: () => void;
}) {
	const target = document.createElement('div');
	document.body.append(target);
	const component = mount(EditorCard, {
		target,
		props: {
			identity: options.identity ?? { sourceId: 'layout:wall:wall-a', label: 'Wall 1', kind: 'Wall', status: 'In the current Plan' },
			facts: options.facts ?? [],
			writer: options.writer ?? null,
			actions: options.actions ?? [],
			technicalFacts: options.technicalFacts ?? [],
			nameWriter: options.nameWriter ?? null,
			onClose: () => {},
			onFocusTask: () => {},
			onOpenTask: () => {},
			onBringIntoView: options.onBringIntoView ?? (() => {})
		}
	});
	cleanup = () => void unmount(component);
	return target;
}

/** The ordinary fact rows (not Technical details), in order. */
function factLabels(target: HTMLElement): string[] {
	return [...target.querySelectorAll('dl.facts:not(.mono) dt')].map((term) => term.textContent ?? '');
}

/** Let mount effects and the action's own settled promise run before the next press. */
async function settle(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

function action(id: string, patch: Partial<StageCardActionRecord> = {}): StageCardActionRecord {
	return {
		id,
		adapterId: 'scene',
		label: id,
		run: vi.fn(async () => ({ kind: 'accepted' as const })),
		...patch
	};
}

describe('Card facts: each fact appears once', () => {
	it('drops a fact whose field the header carries, and one a writer edits, but keeps a read-only fact', () => {
		const target = mountCard({
			facts: [
				{ label: 'Kind', value: 'Door', fieldId: 'kind' },
				{ label: 'Name', value: 'Hall', fieldId: 'name' },
				{ label: 'Height', value: '2.1 m', fieldId: 'height' },
				{ label: 'Thickness', value: '0.2 m', fieldId: 'thickness' },
				{ label: 'Role', value: 'exterior (derived)', fieldId: 'role' },
				{ label: 'Datum', value: '0 m' }
			],
			writer: { summary: 'Wall fields', adapterId: 'layout', fieldIds: ['height', 'thickness'] }
		});
		expect(factLabels(target)).toEqual(['Role', 'Datum']);
	});

	it('keeps a fact with no field id, and a fact whose field no writer edits', () => {
		const target = mountCard({
			facts: [
				{ label: 'Position', value: '1 m · 0 m' },
				{ label: 'Material', value: 'plaster', fieldId: 'material' }
			],
			writer: { summary: 'Object fields', adapterId: 'scene', fieldIds: ['position', 'yaw', 'scale'] }
		});
		expect(factLabels(target)).toEqual(['Position', 'Material']);
	});

	it('shows the Card\'s own name in the header, never as a fact row', () => {
		const target = mountCard({
			identity: { sourceId: 'scene:entity:plinth', label: 'Plinth', kind: 'Model', status: 'scene' },
			facts: [{ label: 'Name', value: 'Plinth', fieldId: 'name' }]
		});
		expect(target.querySelector('h2.name')?.textContent).toBe('Plinth');
		expect(factLabels(target)).toEqual([]);
		expect(target.querySelector('.quiet')?.textContent).toBe('No further facts.');
	});

	it('moves diagnostics about the drawing into Technical details, out of the ordinary facts', () => {
		const target = mountCard({
			facts: [{ label: 'Datum', value: '0 m' }],
			technicalFacts: [
				{ label: 'Stream', value: 'canonical' },
				{ label: 'Eligible', value: 'true' },
				{ label: 'Revealed', value: 'false' }
			]
		});
		expect(factLabels(target)).toEqual(['Datum']);
		const technical = [...target.querySelectorAll('.technical dt')].map((term) => term.textContent);
		expect(technical).toEqual(['Canonical ID', 'Stream', 'Eligible', 'Revealed']);
	});
});

describe('Card actions: only a destructive action is destructive', () => {
	it('does not style a secondary, non-destructive Duplicate as destructive, and moves it into More', () => {
		const target = mountCard({
			actions: [
				action('scene-object-duplicate', { label: 'Duplicate', group: 'secondary' }),
				action('scene-object-delete', { label: 'Delete object', destructive: true, detail: 'Remove it.' })
			]
		});
		const duplicate = target.querySelector<HTMLButtonElement>('[data-card-action="scene-object-duplicate"]')!;
		const remove = target.querySelector<HTMLButtonElement>('[data-card-action="scene-object-delete"]')!;
		expect(duplicate.classList.contains('destructive')).toBe(false);
		expect(remove.classList.contains('destructive')).toBe(true);
		expect(duplicate.closest('[data-card-more]')).not.toBeNull();
		expect(remove.closest('[data-card-more]')).toBeNull();
	});

	it('runs a non-destructive action on one press, and asks a destructive one for its second press', async () => {
		const duplicate = action('scene-object-duplicate', { label: 'Duplicate', group: 'secondary' });
		const remove = action('scene-object-delete', { label: 'Delete object', destructive: true, detail: 'Remove it.' });
		const target = mountCard({ actions: [duplicate, remove] });
		await settle();

		target.querySelector<HTMLButtonElement>('[data-card-action="scene-object-duplicate"]')!.click();
		await settle();
		expect(duplicate.run).toHaveBeenCalledTimes(1);

		target.querySelector<HTMLButtonElement>('[data-card-action="scene-object-delete"]')!.click();
		await settle();
		expect(remove.run).not.toHaveBeenCalled();
		expect(target.textContent).toContain('Remove it.');
		target.querySelector<HTMLButtonElement>('[data-card-action="scene-object-delete"]')!.click();
		await settle();
		expect(remove.run).toHaveBeenCalledTimes(1);
	});

	it('keeps a primary non-destructive action in the row without destructive styling', () => {
		const target = mountCard({ actions: [action('layout-something', { label: 'Mirror' })] });
		const button = target.querySelector<HTMLButtonElement>('[data-card-action="layout-something"]')!;
		expect(button.classList.contains('destructive')).toBe(false);
		expect(button.closest('[data-card-more]')).toBeNull();
	});
});

describe('Card name: a generated name never reaches a save', () => {
	it('leaves the rename field empty for a subject with no authored name, while the title shows its label', () => {
		const target = mountCard({
			identity: { sourceId: 'layout:wall:wall-a', label: 'Wall 1', kind: 'Wall', status: 'In the current Plan' },
			nameWriter: { value: '', commit: vi.fn(async () => ({ kind: 'accepted' })) }
		});
		expect(target.querySelector('h2.name')?.textContent).toBe('Wall 1');
		expect(target.querySelector<HTMLInputElement>('input[aria-label="Name"]')?.value).toBe('');
	});

	it('refuses an empty rename without sending anything to the writer', async () => {
		const commit = vi.fn(async () => ({ kind: 'accepted' }));
		const target = mountCard({
			identity: { sourceId: 'layout:wall:wall-a', label: 'Wall 1', kind: 'Wall', status: 'In the current Plan' },
			nameWriter: { value: '', commit }
		});
		await settle();
		target.querySelector('form.rename')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await settle();
		expect(commit).not.toHaveBeenCalled();
		expect(target.querySelector('[role="alert"]')?.textContent).toContain('empty name is not a rename');
	});

	it('commits only the name the creator typed, and never the generated label', async () => {
		const commit = vi.fn(async () => ({ kind: 'accepted' }));
		const target = mountCard({
			identity: { sourceId: 'layout:wall:wall-a', label: 'Wall 1', kind: 'Wall', status: 'In the current Plan' },
			nameWriter: { value: '', commit }
		});
		await settle();
		const input = target.querySelector<HTMLInputElement>('input[aria-label="Name"]')!;
		input.value = 'Kitchen';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		target.querySelector('form.rename')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await settle();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(commit).toHaveBeenCalledWith('Kitchen');
		expect(commit).not.toHaveBeenCalledWith('Wall 1');
	});
});

describe('Card header: a long name stays whole and reads in full', () => {
	it('keeps the full name in the title and the heading, which the header clips with CSS', () => {
		const long = 'The long exterior wall of the east range, with its later-added return to the courtyard';
		const target = mountCard({
			identity: { sourceId: 'layout:wall:wall-a', label: long, kind: 'Wall', status: 'In the current Plan' }
		});
		const heading = target.querySelector<HTMLElement>('h2.name')!;
		expect(heading.textContent).toBe(long);
		expect(heading.getAttribute('title')).toBe(long);
	});
});
