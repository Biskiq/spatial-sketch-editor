// @vitest-environment jsdom
/**
 * Async results belong to the Card field controller and the mount that submitted
 * them.
 *
 * The panel is the same controller S05 shipped, moved from the retired Dimensions
 * task into the Card (Round 2 D9). These properties are about **lifetime**, not
 * about where the panel lives: a settled promise, a refusal and a focus event all
 * arrive in the browser after the panel they belong to may be gone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import LayoutCardFields from '$lib/authoring/adapters/layout/LayoutCardFields.svelte';
import { buildStarterEnclosureLayout } from '$lib/authoring/stage/starter-gallery';
import { layoutCardFieldIds, layoutFacts } from '$lib/authoring/adapters/layout/precision';
import CardFieldsLifetimeProbe from './fixtures/CardFieldsLifetimeProbe.svelte';
import { createCardFieldsInstrument } from '$lib/authoring/adapters/layout/adapter-support';
import type { LayoutInstrument, LayoutInstrumentOutcome } from '$lib/authoring/adapters/layout/instrument';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import { reactiveCell } from './__fixtures__/reactive-cell.svelte';
vi.mock('$lib/authoring/adapters/layout/adapter-support', () => ({ createCardFieldsInstrument: vi.fn() }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
function controller(id: string) {
	let text = '5';
	const fields = vi.fn(() => [{ id: 'length', label: 'Length', unit: 'm' as const, value: '5', text, error: null }]);
	return {
		subject: { kind: 'wall', id }, facts: () => [], fields,
		fixedEndpoint: () => 'start', setFixedEndpoint: vi.fn(),
		pausedProposal: () => ({ wallId: id, label: 'Length' }),
		edit: vi.fn((_id: string, next: string) => { text = next; }),
		cancel: vi.fn(() => { text = '5'; }), blur: vi.fn(() => { text = '5'; }),
		commit: vi.fn(), resumePaused: vi.fn(), dispose: vi.fn()
	} as unknown as LayoutInstrument & { fields: typeof fields };
}
async function panel(probe = false) {
	const first = controller('wall-a'), second = controller('wall-b');
	function services(id: string) {
		return { stage: { selection: () => ({ sourceKind: 'wall', sourceId: id }) } } as unknown as StageAdapterServices;
	}
	const firstServices = services('wall-a'), secondServices = services('wall-b');
	vi.mocked(createCardFieldsInstrument).mockImplementation((value) => value.stage.selection()?.sourceId === 'wall-a' ? first : second);
	const cell = reactiveCell(firstServices);
	const visible = reactiveCell(true);
	const target = document.createElement('div'); document.body.append(target);
	const component = probe
		? mount(CardFieldsLifetimeProbe, { target, props: { get services() { return cell.value; }, get visible() { return visible.value; } } })
		: mount(LayoutCardFields, { target, props: { get services() { return cell.value; } } });
	cleanup = () => { void unmount(component); };
	await tick();
	return { first, second, target, hide: async () => { cell.value = secondServices; visible.value = false; await tick(); }, replace: async () => { cell.value = secondServices; await tick(); }, destroy: async () => { cleanup = undefined; await unmount(component); } };
}
function submit(target: HTMLElement, command: 'commit' | 'resumePaused') {
	if (command === 'resumePaused') target.querySelector<HTMLButtonElement>('[data-resume-paused]')!.click();
	else target.querySelector('input[data-field="length"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}
for (const command of ['commit', 'resumePaused'] as const) {
	describe(`Card field writer ${command} lifetime`, () => {
		it('never reads a destroyed derived or refreshes its retired controller', async () => {
			const { first, target, destroy } = await panel();
			let resolve!: (outcome: LayoutInstrumentOutcome) => void;
			vi.mocked(first[command]).mockReturnValue(new Promise((done) => { resolve = done; }));
			const warn = vi.spyOn(console, 'warn');
			submit(target, command); expect(first[command]).toHaveBeenCalledTimes(1); await destroy(); first.fields.mockClear();
			resolve({ kind: 'accepted' }); await tick();
			expect(first.fields).not.toHaveBeenCalled();
			expect(warn.mock.calls.flat().join(' ')).not.toContain('derived_inert');
			expect(first.dispose).toHaveBeenCalledTimes(1);
		});
		it('does not apply an old refusal or refresh over a replacement panel', async () => {
			const { first, second, target, replace } = await panel();
			let resolve!: (outcome: LayoutInstrumentOutcome) => void;
			vi.mocked(first[command]).mockReturnValue(new Promise((done) => { resolve = done; }));
			submit(target, command); await replace(); const reads = second.fields.mock.calls.length;
			resolve({ kind: 'refused', code: 'stale', message: 'old refusal' }); await tick();
			expect(target.textContent).not.toContain('old refusal');
			expect(second.fields).toHaveBeenCalledTimes(reads);
			expect(first.dispose).toHaveBeenCalledTimes(1);
		});
		it.each(['invalid', 'refused'] as const)('still displays a current %s result', async (kind) => {
			const { first, target } = await panel();
			vi.mocked(first[command]).mockResolvedValue({ kind, code: 'blank', message: 'Keep the current refusal' });
			submit(target, command); await tick();
			await vi.waitFor(() => expect(target.querySelector('[role="alert"]')?.textContent).toBe('Keep the current refusal'));
		});
	});
}
it('Escape and blur restore accepted text without accepting', async () => {
	const { first, target } = await panel();
	const input = target.querySelector<HTMLInputElement>('input[data-field="length"]')!;
	for (const cancel of ['Escape', 'blur']) {
		input.value = '8'; input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(cancel === 'blur' ? new FocusEvent('blur') : new KeyboardEvent('keydown', { key: cancel, bubbles: true }));
		await tick(); expect(input.value).toBe('5');
	}
	expect(first.commit).not.toHaveBeenCalled();
});


it('handles focused-input removal through an inert branch without stale derived reads', async () => {
	const { first, target, hide } = await panel(true);
	const input = target.querySelector<HTMLInputElement>('input[data-field="length"]')!;
	input.focus();
	const warn = vi.spyOn(console, 'warn');
	let disposed = false;
	vi.mocked(first.dispose).mockImplementation(() => { disposed = true; });
	vi.mocked(first.blur).mockImplementation(() => {
		expect(disposed).toBe(false);
		return null;
	});
	// jsdom does not emit native blur when a focused subtree is removed. Mirror
	// that browser event while Svelte's conditional branch is inert, before its
	// teardown callbacks run: this was the production warning path.
	const remove = Element.prototype.remove;
	const removal = vi.spyOn(Element.prototype, 'remove').mockImplementation(function (this: Element) {
		if (this.contains(input)) input.dispatchEvent(new FocusEvent('blur'));
		remove.call(this);
	});
	await hide();
	removal.mockRestore();
	expect(first.dispose).toHaveBeenCalledTimes(1);
	expect(warn.mock.calls.flat().join(' ')).not.toContain('derived_inert');
	const calls = vi.mocked(first.blur).mock.calls.length;
	input.dispatchEvent(new FocusEvent('blur'));
	await tick();
	expect(first.blur).toHaveBeenCalledTimes(calls);
});

it('an outgoing detached input cannot cancel a replacement controller draft', async () => {
	const { first, second, target, replace } = await panel();
	const outgoing = target.querySelector<HTMLInputElement>('input[data-field="length"]')!;
	outgoing.focus();
	second.fields.mockReturnValue([{ id: 'width', label: 'Width', unit: 'm', value: '5', text: '7', error: null }]);
	await replace();
	expect(outgoing.isConnected).toBe(false);
	vi.mocked(first.blur).mockClear();
	vi.mocked(second.blur).mockClear();
	outgoing.dispatchEvent(new FocusEvent('blur'));
	await tick();
	expect(first.blur).not.toHaveBeenCalled();
	expect(second.blur).not.toHaveBeenCalled();
	expect(target.querySelector<HTMLInputElement>('input[data-field="width"]')?.value).toBe('7');
});

describe('the Layout writer and the Card facts divide the subject\'s fields', () => {
	it('gives the writer every editable field but the name, and leaves only the derived Role as a fact row', () => {
		const layout = buildStarterEnclosureLayout();
		const subject = { kind: 'wall' as const, id: layout.walls[0]!.id };
		const writer = layoutCardFieldIds(layout, subject);
		expect(writer).toEqual(expect.arrayContaining(['height', 'thickness', 'length', 'angle']));
		expect(writer).not.toContain('name');
		const rows = layoutFacts(layout, subject)
			.filter((fact) => fact.fieldId !== 'kind' && fact.fieldId !== 'name' && !writer.includes(fact.fieldId))
			.map((fact) => fact.label);
		expect(rows).toEqual(['Role']);
	});
});
