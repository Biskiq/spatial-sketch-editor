// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
	createStageKeyboard,
	type StageKeyboardInput
} from '$lib/authoring/stage/route/stage-keyboard';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';

type IntentClaim = { readonly claimed: boolean; readonly adapterId: string | null };
const unclaimed: IntentClaim = { claimed: false, adapterId: null };

function harness(overrides: Partial<StageKeyboardInput> = {}) {
	const calls: string[] = [];
	const facade = {
		gestureKeyIntent: vi.fn(() => unclaimed),
		keyboardIntent: vi.fn(() => unclaimed),
		selectionKeyIntent: vi.fn(() => unclaimed),
		closeDisclosure: vi.fn(() => false),
		notifySurfaceChange: vi.fn()
	} as unknown as StageFacade;
	const input: StageKeyboardInput = {
		artworkEscape: () => false,
		previewActive: () => false,
		closePreview: () => calls.push('close-preview'),
		activeLayer: () => null,
		pressing: () => false,
		dragMode: () => null,
		facade: () => facade,
		reducedMotion: () => false,
		nowSeconds: () => 0,
		submit: () => null,
		setReading: (reading) => calls.push(`reading:${reading}`),
		zoom: (scale) => calls.push(`zoom:${scale}`),
		fit: () => calls.push('fit'),
		pan: (dx, dy) => calls.push(`pan:${dx},${dy}`),
		pressDockSlot: (slot) => calls.push(`tool:${slot}`),
		requestDelete: () => calls.push('request-delete'),
		openCard: () => calls.push('open-card'),
		pendingDelete: () => false,
		clearPendingDelete: () => calls.push('clear-pending-delete'),
		interrupt: (reason) => calls.push(`interrupt:${reason}`),
		task: () => null,
		closeTask: () => calls.push('close-task'),
		armedHostTool: () => null,
		measureTool: () => null,
		eraserTool: () => null,
		clearEraseHover: () => calls.push('clear-erase-hover'),
		refreshHostTools: () => calls.push('refresh-host-tools'),
		armedDockKey: () => undefined,
		paletteOpen: () => false,
		closePalette: () => calls.push('close-palette'),
		libraryOpen: () => false,
		toggleLibrary: () => calls.push('toggle-library'),
		activeWorldTool: () => 'select',
		clearWorldTool: () => calls.push('clear-world-tool'),
		worldPlateOpen: () => false,
		closeWorldPlate: () => calls.push('close-world-plate'),
		lens: () => 'world',
		selectionPresent: () => false,
		closeSelection: () => calls.push('close-selection'),
		...overrides
	};
	return { calls, facade, keyboard: createStageKeyboard(input) };
}

function keyEvent(
	key: string,
	options: {
		readonly target?: EventTarget;
		readonly altKey?: boolean;
		readonly metaKey?: boolean;
		readonly ctrlKey?: boolean;
	} = {}
): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		altKey: options.altKey ?? false,
		metaKey: options.metaKey ?? false,
		ctrlKey: options.ctrlKey ?? false
	});
	Object.defineProperty(event, 'target', { value: options.target ?? document.body });
	return event;
}

describe('stage keyboard arbitration', () => {
	it('gives an armed Artwork Escape before Preview and every shared unwind', () => {
		const preview = vi.fn(() => true);
		const { calls, keyboard } = harness({ artworkEscape: () => true, closePreview: preview });
		const event = keyEvent('Escape');
		const prevent = vi.spyOn(event, 'preventDefault');

		keyboard.handleKey(event);

		expect(prevent).toHaveBeenCalledOnce();
		expect(preview).not.toHaveBeenCalled();
		expect(calls).toEqual([]);
	});

	it('lets Preview answer only Escape and never moves the Stage camera', () => {
		const { calls, facade, keyboard } = harness({ previewActive: () => true });

		keyboard.handleKey(keyEvent('Escape'));
		keyboard.handleKey(keyEvent('f'));
		keyboard.handleKey(keyEvent('2'));

		expect(calls).toEqual(['close-preview']);
		expect(facade.keyboardIntent).not.toHaveBeenCalled();
	});

	it('never moves the camera while a text field has the key', () => {
		const { calls, keyboard } = harness();
		const input = document.createElement('input');
		document.body.append(input);

		keyboard.handleKey(keyEvent('f', { target: input }));
		keyboard.handleKey(keyEvent('2', { target: input }));

		expect(calls).toEqual([]);
		input.remove();
	});

	it('leaves an activation key to the focused control before the armed command', () => {
		const { facade, keyboard } = harness();
		const button = document.createElement('button');
		document.body.append(button);

		keyboard.handleKey(keyEvent('Enter', { target: button }));

		expect(facade.gestureKeyIntent).not.toHaveBeenCalled();
		expect(facade.keyboardIntent).not.toHaveBeenCalled();
		button.remove();
	});

	it('keeps dock letters and 2 with a live numeric writer', () => {
		const { calls, facade, keyboard } = harness({ pressing: () => true });
		vi.mocked(facade.gestureKeyIntent).mockReturnValue({ claimed: true, adapterId: 'fixture' });

		const event = keyEvent('2');
		const prevent = vi.spyOn(event, 'preventDefault');
		keyboard.handleKey(event);

		expect(facade.gestureKeyIntent).toHaveBeenCalledWith({ kind: 'type', key: '2' });
		expect(prevent).toHaveBeenCalledOnce();
		expect(calls).toEqual([]);
	});

	it('runs gesture, then task, then selection for Backspace and stops at the claim', () => {
		const { calls, facade, keyboard } = harness();
		vi.mocked(facade.keyboardIntent).mockReturnValue({ claimed: true, adapterId: 'fixture' });

		const event = keyEvent('Backspace');
		const prevent = vi.spyOn(event, 'preventDefault');
		keyboard.handleKey(event);

		expect(calls).toEqual([]);
		expect(facade.gestureKeyIntent).toHaveBeenCalledWith({ kind: 'backtrack' });
		expect(facade.keyboardIntent).toHaveBeenCalledWith({ kind: 'backtrack' });
		expect(facade.selectionKeyIntent).not.toHaveBeenCalled();
		expect(prevent).toHaveBeenCalledOnce();
	});

	it('unwinds a pending destructive confirmation before any task or tool', () => {
		const { calls, keyboard } = harness({ pendingDelete: () => true, task: () => ({}) as never });

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual(['clear-pending-delete']);
	});

	it('unwinds a live disclosure before the shared press interruption', () => {
		const { calls, facade, keyboard } = harness();
		vi.mocked(facade.closeDisclosure).mockReturnValue(true);

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual([]);
		expect(facade.notifySurfaceChange).toHaveBeenCalled();
	});

	it('interrupts a live press once and does not also close the task', () => {
		const { calls, keyboard } = harness({ pressing: () => true, task: () => ({}) as never });

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual(['interrupt:escape']);
	});

	it('clears a host measurement before folding the palette or task', () => {
		const { calls, keyboard } = harness({
			armedHostTool: () => 'measure',
			measureTool: () => ({ clear: () => true }) as never,
			task: () => ({}) as never
		});

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual(['interrupt:escape', 'refresh-host-tools']);
	});

	it('folds an armed task palette before the task itself', () => {
		const { calls, keyboard } = harness({
			task: () => ({}) as never,
			armedDockKey: () => ({ palette: true }),
			paletteOpen: () => true
		});

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual(['interrupt:escape', 'close-palette']);
	});

	it('folds the Library before closing its task', () => {
		const { calls, keyboard } = harness({ task: () => ({}) as never, libraryOpen: () => true });

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual(['interrupt:escape', 'toggle-library']);
	});

	it('folds the plate, then clears the selection, as the last layers', () => {
		const { calls, keyboard } = harness({ worldPlateOpen: () => true, selectionPresent: () => true });

		keyboard.handleKey(keyEvent('Escape'));

		expect(calls).toEqual(['interrupt:escape', 'close-world-plate']);
	});

	it('opens the Card on Alt+Left only after the focused posture claims the key', () => {
		const claimed = { key: vi.fn(() => 'claimed' as const) };
		const claimedHarness = harness({ activeLayer: () => claimed as never });
		claimedHarness.keyboard.handleKey(keyEvent('ArrowLeft', { altKey: true }));
		expect(claimedHarness.calls).toEqual(['open-card']);

		const unclaimedLayer = { key: vi.fn(() => 'unclaimed' as const) };
		const unclaimedHarness = harness({ activeLayer: () => unclaimedLayer as never });
		unclaimedHarness.keyboard.handleKey(keyEvent('ArrowLeft', { altKey: true }));
		expect(unclaimedHarness.calls).toEqual([]);
	});

	it('keeps the dock out of the Experience lens and its modified letters with the platform', () => {
		const experience = harness({ lens: () => 'experience' });
		experience.keyboard.handleKey(keyEvent('v'));
		expect(experience.calls).toEqual([]);

		const world = harness();
		world.keyboard.handleKey(keyEvent('v', { metaKey: true }));
		expect(world.calls).toEqual([]);
		world.keyboard.handleKey(keyEvent('v'));
		expect(world.calls).toEqual(['tool:select']);
	});
});
